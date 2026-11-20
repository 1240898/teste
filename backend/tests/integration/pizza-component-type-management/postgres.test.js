import '../../../src/shared/config/index.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { PostgresComponentTypeRepository } from '../../../src/modules/pizza-component-type-management/infrastructure/persistence/PostgresComponentTypeRepository.js';
import { PostgresUnitOfWork } from '../../../src/shared/persistence/postgres/PostgresUnitOfWork.js';
import { ComponentTypeService } from '../../../src/modules/pizza-component-type-management/application/services/ComponentTypeService.js';
import { PostgresComponentTypeImpactGuard } from '../../../src/modules/pizza-component-type-management/infrastructure/persistence/PostgresComponentTypeImpactGuard.js';
import { ComponentTypeId } from '../../../src/modules/pizza-component-type-management/domain/model/values.js';
import { readdir } from 'node:fs/promises';

const describeDatabase =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

describeDatabase(
  'BCK07 PostgreSQL (isolated schema in dedicated _test database)',
  () => {
    let database;
    let repository;
    let service;
    const impact = new PostgresComponentTypeImpactGuard();

    beforeAll(async () => {
      database = await isolatedDatabase();
      repository = new PostgresComponentTypeRepository(database);
      service = new ComponentTypeService(
        repository,
        new PostgresUnitOfWork(database),
        impact,
      );
    });

    afterAll(async () => {
      await database?.close();
    });

    test('migrates the four initial types once and preserves edited data on replay', async () => {
      const files = (
        await readdir(new URL('../../../migrations/', import.meta.url))
      ).filter((name) => name.endsWith('.sql'));

      expect(await migrate(database)).toBe(files.length);
      const initial = await service.search({});
      expect(initial.map((type) => type.id)).toEqual([
        'type-01',
        'type-02',
        'type-03',
        'type-04',
      ]);
      expect(initial).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Base Dough',
            assemblyOrder: 1,
            minQuantity: 1,
            maxQuantity: 1,
          }),
          expect.objectContaining({
            name: 'Base Sauce',
            assemblyOrder: 2,
            minQuantity: 0,
            maxQuantity: 1,
          }),
          expect.objectContaining({
            name: 'Cheese',
            assemblyOrder: 3,
            minQuantity: 0,
            maxQuantity: 1,
          }),
          expect.objectContaining({
            name: 'Topping',
            assemblyOrder: 4,
            minQuantity: 0,
            maxQuantity: null,
          }),
        ]),
      );
      const dough = initial.find((type) => type.assemblyOrder === 1);
      const created = await service.create({
        name: 'Garlic Oil',
        assemblyOrder: 5,
        minQuantity: 0,
        maxQuantity: 1,
      });
      expect(created.id).toBe('type-05');
      await service.update(ComponentTypeId.create(dough.id), {
        name: 'Pizza Base',
      });
      expect(await migrate(database)).toBe(0);
      expect(
        await service.getById(ComponentTypeId.create(dough.id)),
      ).toMatchObject({
        name: 'Pizza Base',
      });
    });

    test('enforces unique order and case-insensitive unique names in PostgreSQL', async () => {
      await expect(
        service.create({
          name: 'pIzZa BaSe',
          assemblyOrder: 5,
          minQuantity: 0,
          maxQuantity: null,
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        service.create({
          name: 'Additional Cheese',
          assemblyOrder: 1,
          minQuantity: 0,
          maxQuantity: 1,
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    test('allows only one concurrent create for the same assembly order', async () => {
      const results = await Promise.allSettled([
        service.create({
          name: 'Concurrent Type A',
          assemblyOrder: 9,
          minQuantity: 0,
          maxQuantity: 1,
        }),
        service.create({
          name: 'Concurrent Type B',
          assemblyOrder: 9,
          minQuantity: 0,
          maxQuantity: 1,
        }),
      ]);

      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === 'rejected').reason,
      ).toMatchObject({ status: 409 });
    });

    test('allows exact case-insensitive name search and OR filters', async () => {
      const result = await service.search({ id: 'missing', name: 'cHeEsE' });
      expect(result).toEqual([
        expect.objectContaining({ name: 'Cheese', assemblyOrder: 3 }),
      ]);
    });

    test('updates bounds without rewriting or rejecting stored BCK10 compositions', async () => {
      await database.query(
        `INSERT INTO product_categories (id, name)
         VALUES ('CAT-90001', 'BCK07 impact test')`,
      );
      await database.query(
        `INSERT INTO products
           (id, name, description, category_id, is_sellable, is_pizza_component,
            acquisition_type, pizza_component_type_id, pricing_mode,
            base_price_amount, base_price_currency)
         VALUES
           ('PROD-90001', 'Impact test pizza', 'Representative product for impact test',
            'CAT-90001', TRUE, FALSE, 'PRODUCED', NULL, 'COMPONENT_BASED', NULL, NULL),
           ('PROD-90002', 'Impact topping one', 'First configured topping',
            'CAT-90001', FALSE, TRUE, 'PURCHASED', 'type-04', NULL, NULL, NULL),
           ('PROD-90003', 'Impact topping two', 'Second configured topping',
            'CAT-90001', FALSE, TRUE, 'PURCHASED', 'type-04', NULL, NULL, NULL),
           ('PROD-90004', 'Impact test pizza two', 'Second representative product',
            'CAT-90001', TRUE, FALSE, 'PRODUCED', NULL, 'COMPONENT_BASED', NULL, NULL),
           ('PROD-90005', 'Impact topping three', 'Topping for second pizza',
            'CAT-90001', FALSE, TRUE, 'PURCHASED', 'type-04', NULL, NULL, NULL)`,
      );
      await database.query(
        `INSERT INTO product_composition_items (parent_product_id, child_product_id, quantity)
         VALUES ('PROD-90001', 'PROD-90002', 1),
                ('PROD-90001', 'PROD-90003', 1),
                ('PROD-90004', 'PROD-90005', 1)`,
      );

      await expect(
        service.update(ComponentTypeId.create('type-04'), { minQuantity: 1 }),
      ).resolves.toMatchObject({ minQuantity: 1, maxQuantity: null });
      await expect(
        service.update(ComponentTypeId.create('type-04'), { maxQuantity: 1 }),
      ).resolves.toMatchObject({ minQuantity: 1, maxQuantity: 1 });
      const preserved = await database.query(
        `SELECT child_product_id FROM product_composition_items
         WHERE parent_product_id = 'PROD-90001'
         ORDER BY child_product_id`,
      );
      expect(preserved.rows.map((row) => row.child_product_id)).toEqual([
        'PROD-90002',
        'PROD-90003',
      ]);
    });
  },
);
