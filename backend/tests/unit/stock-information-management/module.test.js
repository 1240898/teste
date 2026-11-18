import { createStockModule } from '../../../src/modules/stock-information-management/index.js';

test('requires a database or explicit persistence adapters', () => {
  expect(() =>
    createStockModule({
      authMiddleware: { verifyToken() {} },
    }),
  ).toThrow('database or stock repository');
});

test('exposes separate stock lifecycle and order-consumption contracts', () => {
  const module = createStockModule({
    repository: {},
    queryRepository: {},
    productReader: {},
    unitOfWork: {},
    authMiddleware: { verifyToken() {} },
  });

  expect(Object.keys(module.stockProvisioning).sort()).toEqual([
    'disableForProduct',
    'initializeForProduct',
  ]);
  expect(Object.keys(module.stockConsumption)).toEqual(['consumeForOrder']);
  expect(Object.isFrozen(module.stockProvisioning)).toBe(true);
  expect(Object.isFrozen(module.stockConsumption)).toBe(true);
});
