import { jest } from '@jest/globals';
import { AppError } from '../../../../src/shared/errors/AppError.js';
import { PostgresComponentConfigurationRepository } from '../../../../src/modules/pizza-component-configuration/infrastructure/persistence/PostgresComponentConfigurationRepository.js';
import { ComponentSizeConfiguration } from '../../../../src/modules/pizza-component-configuration/domain/model/ComponentSizeConfiguration.js';
import {
  Money,
  PizzaSizeId,
  ProductId,
} from '../../../../src/modules/pizza-component-configuration/domain/model/values.js';

const product = {
  getId: () => ProductId.create('product-1'),
  isPizzaComponent: () => true,
  isStockControlled: () => true,
};
const size = { getId: () => PizzaSizeId.create('size-m') };
const configuration = ComponentSizeConfiguration.create(
  product,
  size,
  Money.create('2.50', 'EUR'),
  2,
);

function dependencies() {
  return {
    products: {
      findById: jest.fn(async () => product),
    },
    sizes: {
      findById: jest.fn(async () => size),
    },
  };
}

describe('BCK08 PostgreSQL repository contract', () => {
  test('maps a pair row to the aggregate using the owning references', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            product_id: 'product-1',
            size_id: 'size-m',
            price_amount: '2.50',
            price_currency: 'EUR',
            stock_units_consumed: 2,
          },
        ],
      }),
    };
    const deps = dependencies();
    const repository = new PostgresComponentConfigurationRepository(
      database,
      deps,
    );

    const result = await repository.findByPair(
      ProductId.create('product-1'),
      PizzaSizeId.create('size-m'),
    );

    expect(result.getPrice().getAmount()).toBe('2.50');
    expect(result.getStockUnitsConsumed().getUnits()).toBe(2);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE product_id = $1 AND size_id = $2'),
      ['product-1', 'size-m'],
    );
  });

  test('queries product configurations in deterministic size order', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new PostgresComponentConfigurationRepository(
      database,
      dependencies(),
    );
    await repository.findByProduct(ProductId.create('product-1'));
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE product_id = $1 ORDER BY size_id'),
      ['product-1'],
    );
  });

  test('persists canonical aggregate values and maps known conflicts', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new PostgresComponentConfigurationRepository(
      {},
      dependencies(),
    );
    await repository.insert(configuration, tx);
    expect(tx.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO component_size_configurations'),
      ['product-1', 'size-m', '2.50', 'EUR', 2],
    );

    const failingTx = {
      query: jest.fn().mockRejectedValue({
        code: '23505',
        constraint: 'component_size_configurations_pkey',
      }),
    };
    await expect(
      repository.insert(configuration, failingTx),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  test('maps missing rows and foreign-key conflicts correctly', async () => {
    const missing = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new PostgresComponentConfigurationRepository(
      missing,
      dependencies(),
    );
    await expect(
      repository.findByPair(
        ProductId.create('missing'),
        PizzaSizeId.create('size-m'),
      ),
    ).resolves.toBeNull();
    await expect(
      repository.save(configuration, missing),
    ).rejects.toBeInstanceOf(AppError);
  });
});
