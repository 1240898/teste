import '../../../src/shared/config/index.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { createProductManagementModule } from '../../../src/modules/product-management/index.js';
import { ProductRepository } from '../../../src/modules/product-management/infrastructure/persistence/ProductRepository.js';
import { ProductId } from '../../../src/modules/product-management/domain/model/ProductId.js';

const describeDB = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const authMiddleware = { verifyToken: (_req, _res, next) => next() };
const sellable = (overrides = {}) => ({
  name: 'Coca-Cola 33cl',
  description: 'Soft drink can',
  categoryId: 'CAT-00001',
  isSellable: true,
  isPizzaComponent: false,
  acquisitionType: 'PURCHASED',
  compositionItems: [],
  pizzaComponentTypeId: null,
  allergenIds: [],
  pricingMode: 'FIXED',
  basePrice: 1.5,
  ...overrides,
});
const component = (overrides = {}) =>
  sellable({
    name: 'Mozzarella Cheese',
    description: 'Shredded mozzarella',
    isSellable: false,
    isPizzaComponent: true,
    acquisitionType: 'PRODUCED',
    pizzaComponentTypeId: 'type-03',
    allergenIds: [7],
    pricingMode: null,
    basePrice: null,
    ...overrides,
  });
const pizza = (compositionItems, overrides = {}) =>
  sellable({
    name: 'Margherita',
    description: 'Pizza recipe',
    acquisitionType: 'PRODUCED',
    compositionItems,
    pricingMode: 'COMPONENT_BASED',
    basePrice: null,
    ...overrides,
  });

describeDB('BCK05 PostgreSQL (isolated schema in dedicated _test database)', () => {
  let database, module, service;

  beforeAll(async () => {
    database = await isolatedDatabase();
    await migrate(database);
    await database.query(
      `INSERT INTO product_categories (id, name)
       VALUES ('CAT-00001', 'Drinks'), ('CAT-00002', 'Ingredients')`,
    );
    await database.query(
      `INSERT INTO allergens (id, name) VALUES (1, 'Gluten'), (7, 'Milk')`,
    );
    module = createProductManagementModule({ database, authMiddleware });
    service = module.productService;
  });

  afterAll(async () => {
    await database?.close();
  });

  test('migration creates composition storage and is idempotent', async () => {
    const { rows } = await database.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'products'`,
    );
    expect(rows.map((row) => row.column_name)).toContain('acquisition_type');
    const { rows: tables } = await database.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name = 'product_composition_items'`,
    );
    expect(tables).toHaveLength(1);
    expect(await migrate(database)).toBe(0);
  });

  test('persists, reloads and updates one summed row per child product', async () => {
    const child = await service.createProduct(component());
    const created = await service.createProduct(
      pizza([
        { productId: child.id, quantity: 2 },
        { productId: child.id, quantity: 3 },
      ]),
    );
    expect(created.compositionItems).toEqual([
      { productId: child.id, quantity: 5 },
    ]);
    const savedRows = await database.query(
      `SELECT child_product_id, quantity FROM product_composition_items
       WHERE parent_product_id = $1`,
      [created.id],
    );
    expect(savedRows.rows).toEqual([
      { child_product_id: child.id, quantity: 5 },
    ]);
    expect((await service.getProductById(created.id)).compositionItems).toEqual(
      created.compositionItems,
    );

    const updated = await service.updateProduct(
      created.id,
      pizza([
        { productId: child.id, quantity: 4 },
        { productId: child.id, quantity: 1 },
      ]),
    );
    expect(updated.compositionItems).toEqual([
      { productId: child.id, quantity: 5 },
    ]);
    const updatedRows = await database.query(
      `SELECT child_product_id, quantity FROM product_composition_items
       WHERE parent_product_id = $1`,
      [created.id],
    );
    expect(updatedRows.rows).toEqual([
      { child_product_id: child.id, quantity: 5 },
    ]);
  });

  test('rejects a composition cycle', async () => {
    const first = await service.createProduct(pizza([]));
    const second = await service.createProduct(
      pizza([{ productId: first.id, quantity: 1 }], { name: 'Second pizza' }),
    );
    await expect(
      service.updateProduct(
        first.id,
        pizza([{ productId: second.id, quantity: 1 }]),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  test('returns 404 for missing references and writes nothing', async () => {
    const before = await database.query('SELECT count(*)::int AS n FROM products');
    await expect(
      service.createProduct(sellable({ categoryId: 'CAT-00099' })),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.createProduct(component({ pizzaComponentTypeId: 'type-99' })),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.createProduct(component({ allergenIds: [14] })),
    ).rejects.toMatchObject({ status: 404 });
    const after = await database.query('SELECT count(*)::int AS n FROM products');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  test('search filters by acquisition and allergen exclusion', async () => {
    await service.createProduct(component({ allergenIds: [7] }));
    await service.createProduct(sellable({ name: 'Orange Juice' }));
    const purchased = await service.listProducts({ acquisitionType: 'PURCHASED' });
    expect(purchased.map((product) => product.name)).toContain('Orange Juice');
    const withoutMilk = await service.listProducts({ excludeAllergenIds: '7' });
    expect(withoutMilk.every((product) => !product.allergenIds.includes(7))).toBe(true);
  });

  test('repository allocates sequential IDs and requires a transaction for row locks', async () => {
    const repository = new ProductRepository(database);
    const first = await repository.nextId();
    const second = await repository.nextId();
    expect(Number(second.getValue().slice(5))).toBe(Number(first.getValue().slice(5)) + 1);
    await expect(repository.findByIdForUpdate(ProductId.create('PROD-00001')))
      .rejects.toThrow(TypeError);
  });
});
