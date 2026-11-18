import '../../../src/shared/config/index.js';
import { ProductId } from '../../../src/modules/stock-information-management/domain/model/values.js';
import { StockManagementService } from '../../../src/modules/stock-information-management/application/services/StockManagementService.js';
import { ProductModuleProductReader } from '../../../src/modules/stock-information-management/infrastructure/products/ProductModuleProductReader.js';
import { PostgresStockRepository } from '../../../src/modules/stock-information-management/infrastructure/persistence/PostgresStockRepository.js';
import { PostgresUnitOfWork } from '../../../src/shared/persistence/postgres/PostgresUnitOfWork.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';

const describeDatabase =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

describeDatabase('BCK09 PostgreSQL stock tracking periods', () => {
  let database;
  let repository;
  let service;
  const productId = ProductId.create('PROD-00123');

  beforeAll(async () => {
    database = await isolatedDatabase();
    await migrate(database);
    expect(await migrate(database)).toBe(0);
    await database.query(
      `INSERT INTO product_categories (id, name)
       VALUES ('CAT-00001', 'Ingredients') ON CONFLICT (id) DO NOTHING`,
    );
    repository = new PostgresStockRepository(database);
    service = new StockManagementService(
      repository,
      repository,
      new ProductModuleProductReader(database),
      new PostgresUnitOfWork(database),
    );
  });

  afterAll(async () => {
    await database?.close();
  });

  beforeEach(async () => {
    await database.query(
      `INSERT INTO products (
         id, name, description, category_id, is_sellable,
         is_pizza_component, acquisition_type, pricing_mode,
         base_price_amount, base_price_currency
       ) VALUES (
         $1, 'Mozzarella', 'Mozzarella stock product', 'CAT-00001',
         true, false, 'PURCHASED', 'FIXED', 0, 'EUR'
       ) ON CONFLICT (id) DO UPDATE SET is_active = true`,
      [productId.getValue()],
    );
    await database.query('DELETE FROM stock_information');
  });

  test('starts one current period with a generated StockId and default zero quantity', async () => {
    await expect(
      service.startTracking({ productId: productId.getValue() }),
    ).resolves.toMatchObject({
      stockId: expect.stringMatching(/^STOCK-\d{5,}$/),
      productId: 'PROD-00123',
      productName: 'Mozzarella',
      availableUnits: 0,
    });
    await expect(
      service.startTracking({ productId: productId.getValue() }),
    ).rejects.toMatchObject({ status: 409 });
    const { rows } = await database.query(
      'SELECT started_at, ended_at, available_units FROM stock_information WHERE product_id = $1',
      [productId.getValue()],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].started_at).toBeInstanceOf(Date);
    expect(rows[0].ended_at).toBeNull();
    expect(rows[0].available_units).toBe(0);
  });

  test('stops a non-zero period and retains it when a new period starts', async () => {
    const first = await service.startTracking({
      productId: productId.getValue(),
      initialUnits: 13,
    });
    await service.stopTracking(productId);
    const second = await service.startTracking({
      productId: productId.getValue(),
      initialUnits: 4,
    });
    const { rows } = await database.query(
      `SELECT stock_code, available_units, started_at, ended_at
       FROM stock_information WHERE product_id = $1 ORDER BY started_at`,
      [productId.getValue()],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      stock_code: first.stockId,
      available_units: 13,
    });
    expect(rows[0].ended_at).toBeInstanceOf(Date);
    expect(rows[1]).toMatchObject({
      stock_code: second.stockId,
      available_units: 4,
      ended_at: null,
    });
    expect(rows[1].started_at.getTime()).toBeGreaterThanOrEqual(
      rows[0].ended_at.getTime(),
    );

    await expect(
      service.search({
        productId: productId.getValue(),
        historical: true,
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      totalItems: 1,
      items: [
        {
          stockId: first.stockId,
          availableUnits: 13,
          startedAt: rows[0].started_at.toISOString(),
          endedAt: rows[0].ended_at.toISOString(),
        },
      ],
    });
    await expect(
      service.search({
        productId: productId.getValue(),
        historical: false,
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      totalItems: 1,
      items: [
        {
          stockId: second.stockId,
          availableUnits: 4,
          endedAt: null,
        },
      ],
    });
  });

  test('permits administrative stock adjustment when the Product is inactive', async () => {
    await service.startTracking({
      productId: productId.getValue(),
      initialUnits: 5,
    });
    await database.query(
      'UPDATE products SET is_active = false WHERE id = $1',
      [productId.getValue()],
    );
    await expect(
      service.adjustStock(productId, { direction: 'INCREASE', units: 2 }),
    ).resolves.toMatchObject({ availableUnits: 7 });
  });

  test('serializes concurrent decreases and never commits a negative quantity', async () => {
    await service.startTracking({
      productId: productId.getValue(),
      initialUnits: 5,
    });
    const results = await Promise.allSettled([
      service.adjustStock(productId, { direction: 'DECREASE', units: 4 }),
      service.adjustStock(productId, { direction: 'DECREASE', units: 4 }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    await expect(service.getForProduct(productId)).resolves.toMatchObject({
      availableUnits: 1,
    });
  });

  test('order consumption uses the caller transaction and respects Product activity', async () => {
    await service.startTracking({
      productId: productId.getValue(),
      initialUnits: 5,
    });
    await database.withTransaction((tx) =>
      service.consumeForOrder(productId.getValue(), 3, tx),
    );
    await expect(service.getForProduct(productId)).resolves.toMatchObject({
      availableUnits: 2,
    });
    await database.query(
      'UPDATE products SET is_active = false WHERE id = $1',
      [productId.getValue()],
    );
    await expect(
      database.withTransaction((tx) =>
        service.consumeForOrder(productId.getValue(), 1, tx),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(service.getForProduct(productId)).resolves.toMatchObject({
      availableUnits: 2,
    });
  });

  test('rolls back starting a period when the surrounding transaction aborts', async () => {
    await expect(
      database.withTransaction(async (tx) => {
        await service.initializeForProduct(productId.getValue(), tx, 5);
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');
    const { rows } = await database.query(
      'SELECT COUNT(*)::int AS count FROM stock_information WHERE product_id = $1',
      [productId.getValue()],
    );
    expect(rows[0].count).toBe(0);
  });
});
