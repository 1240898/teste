import {
  ProductId,
  StockId,
} from '../../../src/modules/stock-information-management/domain/model/values.js';
import { StockInformation } from '../../../src/modules/stock-information-management/domain/model/StockInformation.js';

describe('BCK09 stock tracking periods', () => {
  const startedAt = new Date('2026-11-04T10:00:00.000Z');

  test('starts a current period with its own StockId and initial quantity', () => {
    const stock = StockInformation.startTracking(
      StockId.create('STOCK-00001'),
      ProductId.create('PROD-00123'),
      8,
      startedAt,
    );

    expect(stock.getStartedAt()).toEqual(startedAt);
    expect(stock.getEndedAt()).toBeNull();
    expect(stock.isCurrent()).toBe(true);
    expect(stock.getAvailableUnits()).toBe(8);
  });

  test('ends a period at the supplied instant and retains its final quantity', () => {
    const stock = StockInformation.startTracking(
      StockId.create('STOCK-00001'),
      ProductId.create('PROD-00123'),
      8,
      startedAt,
    );
    const endedAt = new Date('2026-11-04T11:00:00.000Z');

    stock.endTracking(endedAt);

    expect(stock.getEndedAt()).toEqual(endedAt);
    expect(stock.isCurrent()).toBe(false);
    expect(stock.getAvailableUnits()).toBe(8);
  });

  test('rejects an end instant earlier than the start without closing the period', () => {
    const stock = StockInformation.startTracking(
      StockId.create('STOCK-00001'),
      ProductId.create('PROD-00123'),
      8,
      startedAt,
    );

    expect(() =>
      stock.endTracking(new Date('2026-11-04T09:59:59.999Z')),
    ).toThrow();
    expect(stock.isCurrent()).toBe(true);
    expect(stock.getEndedAt()).toBeNull();
  });

  test('does not allow changes to a completed period', () => {
    const stock = StockInformation.startTracking(
      StockId.create('STOCK-00001'),
      ProductId.create('PROD-00123'),
      8,
      startedAt,
    );
    stock.endTracking(new Date('2026-11-04T11:00:00.000Z'));

    expect(() => stock.increase(1)).toThrow(
      expect.objectContaining({ status: 409 }),
    );
    expect(() => stock.decrease(1)).toThrow(
      expect.objectContaining({ status: 409 }),
    );
    expect(stock.getAvailableUnits()).toBe(8);
  });
});
