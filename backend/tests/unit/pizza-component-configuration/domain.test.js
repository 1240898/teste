import { AppError } from '../../../src/shared/errors/AppError.js';
import { ComponentSizeConfiguration } from '../../../src/modules/pizza-component-configuration/domain/model/ComponentSizeConfiguration.js';
import {
  Money,
  PizzaSizeId,
  ProductId,
  StockUnitsConsumed,
} from '../../../src/modules/pizza-component-configuration/domain/model/values.js';

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

describe('BCK08 domain model', () => {
  test.each([
    ['0', '0.00'],
    ['000.5', '0.50'],
    ['2', '2.00'],
    ['2.5', '2.50'],
    ['12.34', '12.34'],
  ])('canonicalizes EUR amount %p as %p', (input, expected) => {
    expect(Money.create(input, 'EUR').getAmount()).toBe(expected);
  });

  test.each(['-1', '1.001', '1e2', 'Infinity', '', ' 2.00'])(
    'rejects invalid amount %p',
    (amount) => {
      expect(() => Money.create(amount, 'EUR')).toThrow(AppError);
    },
  );

  test('rejects non-EUR currency and preserves canonical currency', () => {
    expect(() => Money.create('1.00', 'USD')).toThrow(AppError);
    expect(Money.create('1.00', 'EUR').getCurrency()).toBe('EUR');
  });

  test.each([0, 2, 10])(
    'accepts non-negative integer stock units %p',
    (units) => {
      expect(StockUnitsConsumed.create(units).getUnits()).toBe(units);
    },
  );

  test.each([-1, 1.5, '1', null])('rejects invalid stock units %p', (units) => {
    expect(() => StockUnitsConsumed.create(units)).toThrow(AppError);
  });

  test('creates a stock-controlled configuration with its composite identity', () => {
    const product = makeProduct();
    const size = makeSize();
    const configuration = ComponentSizeConfiguration.create(
      product,
      size,
      Money.create('2.5', 'EUR'),
      2,
    );

    expect(configuration.getProductId().getValue()).toBe('product-1');
    expect(configuration.getSizeId().getValue()).toBe('size-m');
    expect(configuration.getPrice().getAmount()).toBe('2.50');
    expect(configuration.getStockUnitsConsumed().getUnits()).toBe(2);
  });

  test('requires a positive stock declaration only when the product is stock-controlled', () => {
    expect(() =>
      ComponentSizeConfiguration.create(
        makeProduct({ stockControlled: true }),
        makeSize(),
        Money.create('2.00', 'EUR'),
        null,
      ),
    ).toThrow(AppError);

    expect(() =>
      ComponentSizeConfiguration.create(
        makeProduct({ stockControlled: false }),
        makeSize(),
        Money.create('2.00', 'EUR'),
        0,
      ),
    ).toThrow(AppError);

    const noStock = ComponentSizeConfiguration.create(
      makeProduct({ stockControlled: false }),
      makeSize(),
      Money.create('0', 'EUR'),
      null,
    );
    expect(noStock.getStockUnitsConsumed()).toBeNull();
  });

  test('rejects products that are not designated as pizza components', () => {
    expect(() =>
      ComponentSizeConfiguration.create(
        makeProduct({ component: false }),
        makeSize(),
        Money.create('1.00', 'EUR'),
        0,
      ),
    ).toThrow(AppError);
  });

  test('revises price and consumption while preserving both references', () => {
    const product = makeProduct();
    const original = ComponentSizeConfiguration.create(
      product,
      makeSize(),
      Money.create('1.00', 'EUR'),
      1,
    );
    const revised = original.revised(product, Money.create('2.00', 'EUR'), 0);

    expect(revised.getProductId().getValue()).toBe('product-1');
    expect(revised.getSizeId().getValue()).toBe('size-m');
    expect(revised.getPrice().getAmount()).toBe('2.00');
    expect(revised.getStockUnitsConsumed().getUnits()).toBe(0);
    expect(original.getPrice().getAmount()).toBe('1.00');
    expect(original.getStockUnitsConsumed().getUnits()).toBe(1);
  });
});
