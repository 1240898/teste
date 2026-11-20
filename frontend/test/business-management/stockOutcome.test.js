import { jest } from '@jest/globals';
import {
  verifyStockAdjustment,
  verifyStockStart,
} from '../../src/features/business-management/stock/stockOutcome.js';

const api = (rows) => ({ list: jest.fn().mockResolvedValue(rows) });
const record = (availableUnits, endedAt = null) => ({
  productId: 'PROD-00001',
  availableUnits,
  endedAt,
});
const pending = (values, before = 10) => ({
  recordId: 'PROD-00001',
  before,
  values,
});

test.each([
  ['INCREASE', 13, 'applied'],
  ['DECREASE', 7, 'applied'],
  ['INCREASE', 10, 'notApplied'],
  ['INCREASE', 20, 'unconfirmed'],
])('adjustment %s of 3 units from 10, now %i -> %s', async (direction, now, expected) => {
  await expect(
    verifyStockAdjustment(api([record(now)]), pending({ direction, units: '3' })),
  ).resolves.toBe(expected);
});

test('an adjustment without a current stock record cannot be confirmed', async () => {
  await expect(
    verifyStockAdjustment(
      api([record(13, '2026-01-01T00:00:00Z')]),
      pending({ direction: 'INCREASE', units: '3' }),
    ),
  ).resolves.toBe('unconfirmed');
});

test('a failing lookup is propagated, so the workspace keeps the block', async () => {
  const failing = { list: jest.fn().mockRejectedValue(new Error('down')) };
  await expect(
    verifyStockAdjustment(failing, pending({ direction: 'INCREASE', units: '3' })),
  ).rejects.toThrow('down');
});

test.each([
  [[record(5)], 'applied'],
  [[], 'notApplied'],
  [[record(5, '2026-01-01T00:00:00Z')], 'notApplied'],
])('start tracking with current records %p -> %s', async (rows, expected) => {
  await expect(
    verifyStockStart(api(rows), { values: { productId: ' PROD-00001 ' } }),
  ).resolves.toBe(expected);
});