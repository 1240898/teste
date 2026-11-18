import '../../../src/shared/config/index.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { createCatalogueModule } from '../../../src/modules/product-catalogue-and-information/index.js';
import { ProductId } from '../../../src/modules/product-management/domain/model/ProductId.js';

const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

describeDB(
  'BCK11 PostgreSQL catalogue reads (isolated schema in dedicated _test database)',
  () => {
    let database;
    let catalogue;

    beforeAll(async () => {
      database = await isolatedDatabase();
      await migrate(database);
      await database.query(
        `INSERT INTO product_categories (id, name)
         VALUES ('CAT-00001', 'Pizzas'), ('CAT-00002', 'Ingredients')`,
      );
      await database.query(
        `INSERT INTO allergens (id, name)
         VALUES (1, 'Gluten'), (7, 'Milk')`,
      );
      await database.query(
        `INSERT INTO pizza_sizes (id, name, active)
         VALUES ('PSIZE-0001', 'Small', true), ('PSIZE-0002', 'Large', false)`,
      );
      await database.query(
        `INSERT INTO products (
           id, name, description, category_id, is_sellable, is_pizza_component,
           acquisition_type, is_active, pizza_component_type_id, pricing_mode,
           base_price_amount, base_price_currency
         ) VALUES
          ('PROD-00001', 'Margherita', 'Classic pizza', 'CAT-00001', true, false,
           'PRODUCED', true, null, 'COMPONENT_BASED', null, null),
          ('PROD-00002', 'Dough', 'Pizza base dough', 'CAT-00002', false, true,
           'PRODUCED', true, 'type-01', null, null, null),
          ('PROD-00003', 'Tomato Sauce', 'Tomato sauce', 'CAT-00002', true, true,
           'PURCHASED', true, 'type-02', 'FIXED', 1.50, 'EUR'),
          ('PROD-00004', 'Zero Stock Drink', 'Drink with no stock', 'CAT-00002', true, false,
           'PURCHASED', true, null, 'FIXED', 2.00, 'EUR'),
          ('PROD-00005', 'Inactive Drink', 'Inactive drink', 'CAT-00002', true, false,
           'PURCHASED', false, null, 'FIXED', 2.50, 'EUR')`,
      );
      await database.query(
        `INSERT INTO product_allergens (product_id, allergen_id)
         VALUES ('PROD-00002', 1), ('PROD-00003', 1), ('PROD-00003', 7)`,
      );
      await database.query(
        `INSERT INTO product_composition_items (parent_product_id, child_product_id, quantity)
         VALUES ('PROD-00001', 'PROD-00002', 1), ('PROD-00001', 'PROD-00003', 1)`,
      );
      await database.query(
        `INSERT INTO component_size_configurations
           (product_id, size_id, price_amount, price_currency, stock_units_consumed)
         VALUES
          ('PROD-00002', 'PSIZE-0001', 3.00, 'EUR', 1),
          ('PROD-00003', 'PSIZE-0001', 2.25, 'EUR', null),
          ('PROD-00002', 'PSIZE-0002', 5.00, 'EUR', 3),
          ('PROD-00003', 'PSIZE-0002', 3.75, 'EUR', null)`,
      );
      await database.query(
        `INSERT INTO stock_information
           (id, stock_code, product_id, available_units, started_at, ended_at)
         VALUES
          ('00000000-0000-0000-0000-000000000001', 'STOCK-00001', 'PROD-00002', 2, now(), null),
          ('00000000-0000-0000-0000-000000000002', 'STOCK-00002', 'PROD-00002', 99, now(), now()),
          ('00000000-0000-0000-0000-000000000003', 'STOCK-00003', 'PROD-00004', 0, now(), null)`,
      );
      catalogue = createCatalogueModule({ database });
    });

    afterAll(async () => {
      await database?.close();
    });

    test('projects products, derives pizza data, and calculates size-specific availability', async () => {
      const result = await catalogue.service.list();
      const pizza = result.find(({ id }) => id === 'PROD-00001');
      const zeroStock = result.find(({ id }) => id === 'PROD-00004');
      const inactive = result.find(({ id }) => id === 'PROD-00005');

      expect(pizza).toMatchObject({
        available: true,
        category: { id: 'CAT-00001', name: 'Pizzas' },
        allergens: [
          { id: 1, name: 'Gluten' },
          { id: 7, name: 'Milk' },
        ],
        pizza: {
          defaultComponents: [
            { id: 'PROD-00002', name: 'Dough' },
            { id: 'PROD-00003', name: 'Tomato Sauce' },
          ],
          sizes: [
            {
              sizeId: 'PSIZE-0002',
              sizeName: 'Large',
              price: { amount: '8.75', currency: 'EUR' },
              available: false,
            },
            {
              sizeId: 'PSIZE-0001',
              sizeName: 'Small',
              price: { amount: '5.25', currency: 'EUR' },
              available: true,
            },
          ],
        },
      });
      expect(zeroStock.available).toBe(false);
      expect(inactive.available).toBe(false);
    });

    test('searches exact component full name case-insensitively, returning sellable roots', async () => {
      const result = await catalogue.service.list({
        componentName: 'tOmAtO sAuCe',
      });

      expect(result.map(({ id }) => id)).toEqual(['PROD-00001', 'PROD-00003']);
    });

    test('loads detail through the same catalogue projection', async () => {
      const result = await catalogue.service.getById(
        ProductId.create('PROD-00001'),
      );

      expect(result.id).toBe('PROD-00001');
      expect(
        result.pizza.sizes.find(({ sizeName }) => sizeName === 'Small').price
          .amount,
      ).toBe('5.25');
    });
  },
);
