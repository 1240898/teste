/** @jest-environment jsdom */
import { pendingOutcomes } from '../../../src/shared/hooks/pendingOutcomes.js';

beforeEach(() => window.sessionStorage.clear());

describe('pendingOutcomes (BR25)', () => {
  test('a pending outcome is kept in sessionStorage until it is removed', () => {
    pendingOutcomes.add('stock:adjust:PROD-00001', {
      labelKey: 'managementAdjustStock',
      recordId: 'PROD-00001',
    });
    expect(pendingOutcomes.has('stock:adjust:PROD-00001')).toBe(true);
    pendingOutcomes.remove('stock:adjust:PROD-00001');
    expect(pendingOutcomes.has('stock:adjust:PROD-00001')).toBe(false);
  });

  test('list returns only the entries of one workspace, with their details', () => {
    pendingOutcomes.add('stock:adjust:PROD-00001', { recordId: 'PROD-00001' });
    pendingOutcomes.add('products:create', { labelKey: 'managementCreate' });
    expect(pendingOutcomes.list('stock:')).toEqual([
      expect.objectContaining({
        key: 'stock:adjust:PROD-00001',
        recordId: 'PROD-00001',
      }),
    ]);
  });

  test('different records do not block each other', () => {
    pendingOutcomes.add('stock:adjust:PROD-00001');
    expect(pendingOutcomes.has('stock:adjust:PROD-00002')).toBe(false);
  });
});
