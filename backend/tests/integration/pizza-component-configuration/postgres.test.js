import '../../../src/shared/config/index.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { createProductManagementModule } from '../../../src/modules/product-management/index.js';
import { createStockModule } from '../../../src/modules/stock-information-management/index.js';
import { createPizzaComponentConfigurationModule } from '../../../src/modules/pizza-component-configuration/index.js';
import { PizzaSizeRepository } from '../../../src/modules/pizza-size-management/infrastructure/persistence/PizzaSizeRepository.js';
import {
  PizzaSizeId,
  ProductId,
} from '../../../src/modules/pizza-component-configuration/domain/model/values.js';

const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const authMiddleware = { verifyToken: (_req, _res, next) => next() };

const component = {
  name: 'Mozzarella Cheese',
  description: 'Shredded mozzarella',
  categoryId: 'CAT-00001',
  isSellable: false,
  isPizzaComponent: true,
  acquisitionType: 'PURCHASED',
  compositionItems: [],
  pizzaComponentTypeId: 'type-03',
  allergenIds: [7],
  pricingMode: null,
  basePrice: null,
};

describeDB(
  'BCK08 PostgreSQL (isolated schema in dedicated _test database)',
  () => {
    let database;
    let productModule;
    let stockModule;
    let configurationModule;

    beforeAll(async () => {
      database = await isolatedDatabase();
      await migrate(database);
      await database.query(
        `INSERT INTO product_categories (id, name)
       VALUES ('CAT-00001', 'Ingredients')`,
      );
      await database.query(
        `INSERT INTO allergens (id, name) VALUES (7, 'Milk')`,
      );
      await database.query(
        `INSERT INTO pizza_sizes (id, name) VALUES ('PSIZE-0001', 'Medium')`,
      );

      stockModule = createStockModule({ database, authMiddleware });
      productModule = createProductManagementModule({
        database,
        authMiddleware,
      });
      configurationModule = createPizzaComponentConfigurationModule({
        database,
        authMiddleware,
        products: productModule.productRepository,
        sizes: new PizzaSizeRepository(database),
      });
    });

    afterAll(async () => {
      await database?.close();
    });

    test('persists and updates consumption according to the current stock period', async () => {
      const product =
        await productModule.productService.createProduct(component);
      const productId = ProductId.create(product.id);
      const sizeId = PizzaSizeId.create('PSIZE-0001');
      await stockModule.service.startTracking({ productId: product.id });

      const created = await configurationModule.service.create(
        productId,
        sizeId,
        {
          amount: '2.50',
          currency: 'EUR',
          stockUnitsConsumed: 2,
        },
      );
      expect(created).toEqual({
        productId: product.id,
        sizeId: 'PSIZE-0001',
        amount: '2.50',
        currency: 'EUR',
        stockUnitsConsumed: 2,
      });
      expect(await configurationModule.service.consult(productId)).toEqual([
        created,
      ]);

      const updated = await configurationModule.service.update(
        productId,
        sizeId,
        { amount: '3.00', stockUnitsConsumed: 1 },
      );
      expect(updated).toMatchObject({ amount: '3.00', stockUnitsConsumed: 1 });

      await stockModule.service.stopTracking(product.id);
      expect(await configurationModule.service.consult(productId)).toEqual([
        updated,
      ]);
      await expect(
        configurationModule.service.update(productId, sizeId, {
          stockUnitsConsumed: 1,
        }),
      ).rejects.toThrow('Stock units consumed must be null');
      await expect(
        configurationModule.service.update(productId, sizeId, {
          stockUnitsConsumed: null,
        }),
      ).resolves.toMatchObject({ stockUnitsConsumed: null });
    });
  },
);
