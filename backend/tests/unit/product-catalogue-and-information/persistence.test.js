import { jest } from '@jest/globals';
import { CataloguePersistenceMapper } from '../../../src/modules/product-catalogue-and-information/infrastructure/CataloguePersistenceMapper.js';
import { PostgresCatalogueReader } from '../../../src/modules/product-catalogue-and-information/infrastructure/PostgresCatalogueReader.js';
import { ProductId } from '../../../src/modules/product-management/domain/model/ProductId.js';

const date = '2026-01-01T00:00:00.000Z';
const productRow = {
  id: 'PROD-00001',
  name: 'Margherita',
  description: 'Classic pizza',
  category_id: 'CAT-00001',
  is_sellable: true,
  is_pizza_component: false,
  acquisition_type: 'PRODUCED',
  is_active: true,
  pizza_component_type_id: null,
  allergen_ids: [1],
  pricing_mode: 'FIXED',
  base_price_amount: 7.5,
  base_price_currency: 'EUR',
  created_at: date,
  updated_at: date,
};
const snapshotRow = (overrides = {}) => ({
  roots: [productRow],
  products: [productRow],
  categories: [
    {
      id: 'CAT-00001',
      name: 'Pizza',
      created_at: date,
      updated_at: date,
    },
  ],
  allergens: [{ id: 1, name: 'Gluten', created_at: date, updated_at: date }],
  predefined_pizzas: [],
  component_size_configurations: [],
  sizes: [],
  stock_records: [],
  ...overrides,
});

describe('CataloguePersistenceMapper', () => {
  test('reconstitutes products and resolves category/allergen records', () => {
    const facts = CataloguePersistenceMapper.toFacts([snapshotRow()]);

    expect(facts.getRoots()).toHaveLength(1);
    expect(facts.getRoots()[0].getId().getValue()).toBe('PROD-00001');
    expect(
      facts
        .getCategory(facts.getRoots()[0].getCategoryId())
        .getName()
        .getValue(),
    ).toBe('Pizza');
    expect(
      facts
        .getAllergens(facts.getRoots()[0].getAllergenIds())[0]
        .getName()
        .getValue(),
    ).toBe('Gluten');
  });

  test('reconstitutes only current stock records into the facts snapshot', () => {
    const facts = CataloguePersistenceMapper.toFacts([
      snapshotRow({
        stock_records: [
          {
            stock_code: 'STOCK-00001',
            product_id: 'PROD-00001',
            available_units: 3,
            started_at: date,
            ended_at: null,
          },
          {
            stock_code: 'STOCK-00002',
            product_id: 'PROD-00001',
            available_units: 99,
            started_at: date,
            ended_at: '2026-01-02T00:00:00.000Z',
          },
        ],
      }),
    ]);

    expect(
      facts.getCurrentStock(ProductId.create('PROD-00001')).getAvailableUnits(),
    ).toBe(3);
  });
});

describe('PostgresCatalogueReader', () => {
  test('loads the listing snapshot with one parameterized current-stock query', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [snapshotRow({ roots: [], products: [] })],
      }),
    };
    const reader = new PostgresCatalogueReader(database);

    const result = await reader.loadSellable();

    expect(result.getRoots()).toEqual([]);
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query.mock.calls[0][0]).toMatch(/ended_at\s+IS\s+NULL/i);
    expect(database.query.mock.calls[0][1]).toEqual([null]);
  });

  test('loads one product dependency closure by a parameterized id', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [snapshotRow()] }),
    };
    const reader = new PostgresCatalogueReader(database);
    const id = ProductId.create('PROD-00001');

    await reader.loadFor(id);

    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query.mock.calls[0][1]).toEqual(['PROD-00001']);
  });
});
