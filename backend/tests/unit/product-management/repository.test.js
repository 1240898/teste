import { jest } from '@jest/globals';
import { Product } from '../../../src/modules/product-management/domain/model/Product.js';
import { ProductId } from '../../../src/modules/product-management/domain/model/ProductId.js';
import { ProductCompositionItem } from '../../../src/modules/product-management/domain/model/ProductCompositionItem.js';
import { ProductRepository } from '../../../src/modules/product-management/infrastructure/persistence/ProductRepository.js';

describe('BCK05 Product repository composition persistence', () => {
  test('persists ProductCompositionItems through the shared transaction', async () => {
    const row = {
      id: 'PROD-00123',
      name: 'Pizza',
      description: 'Pizza description',
      category_id: 'CAT-00001',
      is_sellable: true,
      is_pizza_component: false,
      acquisition_type: 'PRODUCED',
      is_active: true,
      pizza_component_type_id: null,
      pricing_mode: 'COMPONENT_BASED',
      base_price_amount: null,
      base_price_currency: null,
      created_at: new Date(),
      updated_at: new Date(),
      allergen_ids: [],
      composition_items: [{ productId: 'PROD-00124', quantity: 1 }],
    };
    const client = {
      query: jest.fn(async (sql) =>
        sql.startsWith('SELECT p.id')
          ? { rows: [row] }
          : { rows: [], rowCount: 1 },
      ),
    };
    const database = { withTransaction: (work) => work(client) };
    const repository = new ProductRepository(database);
    const product = Product.restore({
      id: row.id,
      name: row.name,
      description: row.description,
      categoryId: row.category_id,
      isSellable: true,
      isPizzaComponent: false,
      acquisitionType: 'PRODUCED',
      isActive: true,
      pizzaComponentTypeId: null,
      allergenIds: [],
      pricingMode: 'COMPONENT_BASED',
      basePrice: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      compositionItems: [
        ProductCompositionItem.create(ProductId.create('PROD-00124'), 1),
      ],
    });

    await repository.save(product);

    const compositionInsert = client.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO product_composition_items'),
    );
    expect(compositionInsert[1]).toEqual(['PROD-00123', ['PROD-00124'], [1]]);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringMatching(/SELECT .*composition_items/s),
      ['PROD-00123'],
    );
  });
});
