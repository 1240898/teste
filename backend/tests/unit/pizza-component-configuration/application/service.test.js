import { jest } from '@jest/globals';
import { AppError } from '../../../../src/shared/errors/AppError.js';
import { ComponentSizeConfigurationService } from '../../../../src/modules/pizza-component-configuration/application/services/ComponentSizeConfigurationService.js';
import { ComponentSizeConfiguration } from '../../../../src/modules/pizza-component-configuration/domain/model/ComponentSizeConfiguration.js';
import {
  Money,
  PizzaSizeId,
  ProductId,
} from '../../../../src/modules/pizza-component-configuration/domain/model/values.js';

const makeProduct = ({
  id = 'product-1',
  component = true,
  stockControlled = true,
} = {}) => ({
  getId: () => ProductId.create(id),
  isPizzaComponent: () => component,
  isStockControlled: () => stockControlled,
});

const makeSize = (id = 'size-m') => ({ getId: () => PizzaSizeId.create(id) });

function setup({ product = makeProduct(), size = makeSize() } = {}) {
  const configurations = new Map();
  const key = (productId, sizeId) =>
    `${productId.getValue()}:${sizeId.getValue()}`;
  const products = {
    findById: jest.fn(async (id) =>
      id.getValue() === product.getId().getValue() ? product : null,
    ),
    findByIdForUpdate: jest.fn(async (id) =>
      id.getValue() === product.getId().getValue() ? product : null,
    ),
  };
  const sizes = {
    findById: jest.fn(async (id) =>
      id.getValue() === size.getId().getValue() ? size : null,
    ),
    findByIdForUpdate: jest.fn(async (id) =>
      id.getValue() === size.getId().getValue() ? size : null,
    ),
  };
  const repository = {
    findByPair: jest.fn(
      async (productId, sizeId) =>
        configurations.get(key(productId, sizeId)) ?? null,
    ),
    findByPairForUpdate: jest.fn(
      async (productId, sizeId) =>
        configurations.get(key(productId, sizeId)) ?? null,
    ),
    findByProduct: jest.fn(async (productId) =>
      [...configurations.values()].filter(
        (configuration) =>
          configuration.getProductId().getValue() === productId.getValue(),
      ),
    ),
    insert: jest.fn(async (configuration) => {
      const configurationKey = key(
        configuration.getProductId(),
        configuration.getSizeId(),
      );
      if (configurations.has(configurationKey))
        throw new AppError('Configuration already exists', 409);
      configurations.set(configurationKey, configuration);
    }),
    save: jest.fn(async (configuration) => {
      configurations.set(
        key(configuration.getProductId(), configuration.getSizeId()),
        configuration,
      );
    }),
  };
  const impact = { assertSafeChange: jest.fn(async () => {}) };
  const unitOfWork = { withTransaction: jest.fn(async (work) => work({})) };
  const service = new ComponentSizeConfigurationService({
    repository,
    products,
    sizes,
    unitOfWork,
    impact,
  });
  return {
    service,
    products,
    sizes,
    repository,
    impact,
    configurations,
    product,
    size,
  };
}

describe('BCK08 component-size configuration service', () => {
  test('creates a configuration after locking references and checking impact', async () => {
    const { service, repository, products, sizes, impact } = setup();
    const result = await service.create(
      ProductId.create('product-1'),
      PizzaSizeId.create('size-m'),
      { amount: '2.5', currency: 'EUR', stockUnitsConsumed: 2 },
    );

    expect(result).toEqual({
      productId: 'product-1',
      sizeId: 'size-m',
      amount: '2.50',
      currency: 'EUR',
      stockUnitsConsumed: 2,
    });
    expect(products.findByIdForUpdate).toHaveBeenCalledTimes(1);
    expect(sizes.findByIdForUpdate).toHaveBeenCalledTimes(1);
    expect(repository.insert).toHaveBeenCalledTimes(1);
    expect(impact.assertSafeChange).toHaveBeenCalledWith(
      null,
      expect.any(ComponentSizeConfiguration),
      expect.any(Object),
    );
  });

  test('rejects a missing reference or duplicate pair before writing', async () => {
    const { service, repository, products } = setup();
    await expect(
      service.create(
        ProductId.create('missing'),
        PizzaSizeId.create('size-m'),
        { amount: '1.00', currency: 'EUR', stockUnitsConsumed: 0 },
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(repository.insert).not.toHaveBeenCalled();

    products.findByIdForUpdate.mockResolvedValueOnce(makeProduct());
    await service.create(
      ProductId.create('product-1'),
      PizzaSizeId.create('size-m'),
      { amount: '1.00', currency: 'EUR', stockUnitsConsumed: 0 },
    );
    await expect(
      service.create(
        ProductId.create('product-1'),
        PizzaSizeId.create('size-m'),
        { amount: '2.00', currency: 'EUR', stockUnitsConsumed: 1 },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.insert).toHaveBeenCalledTimes(1);
  });

  test('updates only present fields and preserves explicit zero and null', async () => {
    const { service, configurations, repository } = setup();
    const current = ComponentSizeConfiguration.create(
      makeProduct(),
      makeSize(),
      Money.create('1.00', 'EUR'),
      2,
    );
    configurations.set('product-1:size-m', current);

    const result = await service.update(
      ProductId.create('product-1'),
      PizzaSizeId.create('size-m'),
      { amount: '3', stockUnitsConsumed: 0 },
    );

    expect(result.amount).toBe('3.00');
    expect(result.currency).toBe('EUR');
    expect(result.stockUnitsConsumed).toBe(0);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  test('rejects an update of a missing pair and does not save', async () => {
    const { service, repository } = setup();
    await expect(
      service.update(
        ProductId.create('product-1'),
        PizzaSizeId.create('size-m'),
        { amount: '3.00' },
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(repository.save).not.toHaveBeenCalled();
  });

  test('propagates an impact conflict before persistence', async () => {
    const { service, configurations, repository, impact } = setup();
    const current = ComponentSizeConfiguration.create(
      makeProduct(),
      makeSize(),
      Money.create('1.00', 'EUR'),
      1,
    );
    configurations.set('product-1:size-m', current);
    const conflict = new AppError('Unsafe configuration change', 409);
    impact.assertSafeChange.mockRejectedValue(conflict);

    await expect(
      service.update(
        ProductId.create('product-1'),
        PizzaSizeId.create('size-m'),
        { amount: '2.00' },
      ),
    ).rejects.toBe(conflict);
    expect(repository.save).not.toHaveBeenCalled();
  });

  test('consults configurations for an existing product and returns an empty list when none exist', async () => {
    const { service, repository } = setup();
    expect(await service.consult(ProductId.create('product-1'))).toEqual([]);
    expect(repository.findByProduct).toHaveBeenCalledTimes(1);
  });
});
