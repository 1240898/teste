import { Money } from '../../../src/modules/product-management/domain/model/Money.js';

describe('BCK05 Money.sum', () => {
  test('adds cents-backed values without losing cents', () => {
    const total = Money.sum([
      Money.create(1.1),
      Money.create(2.22),
      Money.create(0.68),
    ]);

    expect(total.getAmount()).toBe(4);
    expect(total.getCurrency()).toBe('EUR');
  });

  test('returns zero for an empty collection', () => {
    expect(Money.sum([]).getAmount()).toBe(0);
  });

  test('rejects values that are not BCK05 Money instances', () => {
    expect(() => Money.sum([{}])).toThrow('Money values are required');
  });
});
