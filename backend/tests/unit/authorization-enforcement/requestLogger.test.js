import { safeRequestPath } from '../../../src/shared/logging/requestLogger.js';

describe('safe request logging path', () => {
  test('logs the route template instead of a concrete path or query', () => {
    expect(
      safeRequestPath({
        path: '/api/v1/customers/CUS-00001',
        originalUrl: '/api/v1/customers?email=person@example.com',
        route: { path: '/api/v1/customers/:id' },
      }),
    ).toBe('/api/v1/customers/:id');
  });

  test('uses the captured full nested route template, never request data', () => {
    expect(
      safeRequestPath({
        authorizationRouteTemplate: '/api/v1/products/:productId/component-configurations/:sizeId',
        originalUrl:
          '/api/v1/products/PROD-00001/component-configurations/SIZE-01?email=secret@example.com',
      }),
    ).toBe('/api/v1/products/:productId/component-configurations/:sizeId');
  });
});
