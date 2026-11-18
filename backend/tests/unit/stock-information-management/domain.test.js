import {
  AbstractStockQuantity,
  ProductId,
  StockId,
} from '../../../src/modules/stock-information-management/domain/model/values.js';
import { StockInformation } from '../../../src/modules/stock-information-management/domain/model/StockInformation.js';

describe('BCK09 stock domain', () => {
  const startedAt = new Date('2026-11-04T10:00:00.000Z');

  test('creates a StockInformation tracking period at zero by default', () => {
    const stock = StockInformation.startTracking(
      StockId.create('STOCK-00001'),
      ProductId.create('PROD-00123'),
      undefined,
      startedAt,
    );
    expect(stock.getAvailableUnits()).toBe(0);
    expect(stock.getStartedAt()).toEqual(startedAt);
    expect(stock.getEndedAt()).toBeNull();
    expect(stock.isCurrent()).toBe(true);
  });

  test.each(['', '   ', 'STOCK-X', 'STOCK-1'])(
    'rejects invalid StockId %j',
    (id) => {
      expect(() => StockId.create(id)).toThrow();
    },
  );

  test.each(['', '   ', null, 42, 'PRODUCT-12345', 'PROD-123'])(
    'rejects invalid ProductId %j',
    (id) => {
      expect(() => ProductId.create(id)).toThrow();
    },
  );

  test.each([-1, 1.5, NaN, '2', null])(
    'rejects invalid initial quantity %j',
    (units) => {
      expect(() =>
        StockInformation.startTracking(
          StockId.create('STOCK-00001'),
          ProductId.create('PROD-00123'),
          units,
          startedAt,
        ),
      ).toThrow();
    },
  );

  test('rejects quantities outside the PostgreSQL integer range', () => {
    expect(() => AbstractStockQuantity.create(2_147_483_648)).toThrow();
    const stock = StockInformation.startTracking(
      StockId.create('STOCK-00001'),
      ProductId.create('PROD-00123'),
      2_147_483_647,
      startedAt,
    );
    expect(() => stock.increase(1)).toThrow(
      expect.objectContaining({ status: 409 }),
    );
    expect(stock.getAvailableUnits()).toBe(2_147_483_647);
  });

  test('increases and decreases available units without allowing a negative value', () => {
    const stock = StockInformation.startTracking(
      StockId.create('STOCK-00001'),
      ProductId.create('PROD-00123'),
      5,
      startedAt,
    );
    stock.increase(3);
    expect(stock.getAvailableUnits()).toBe(8);
    stock.decrease(8);
    expect(stock.getAvailableUnits()).toBe(0);
    expect(() => stock.decrease(1)).toThrow(
      expect.objectContaining({ status: 409 }),
    );
  });

  test.each([0, -1, 1.25, NaN, '3', null])(
    'rejects invalid adjustment %j',
    (units) => {
      const stock = StockInformation.startTracking(
        StockId.create('STOCK-00001'),
        ProductId.create('PROD-00123'),
        4,
        startedAt,
      );
      expect(() => stock.increase(units)).toThrow();
      expect(stock.getAvailableUnits()).toBe(4);
    },
  );
});
