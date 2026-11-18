import { openApiSpec } from '../../../src/shared/openapi/spec.js';

test('publishes the BCK09 stock lifecycle and management API', () => {
  expect(openApiSpec.paths['/stock'].post).toBeDefined();
  expect(openApiSpec.paths['/stock'].get).toBeDefined();
  expect(openApiSpec.paths['/stock/{productId}'].get).toBeDefined();
  expect(
    openApiSpec.paths['/stock/{productId}'].delete.responses[204],
  ).toBeDefined();
  expect(
    openApiSpec.paths['/stock/{productId}/adjustments'].post,
  ).toBeDefined();

  const startRequest = openApiSpec.components.schemas.StartStockTrackingRequest;
  expect(startRequest.required).toEqual(['productId']);
  expect(startRequest.properties.initialUnits).toMatchObject({
    type: 'integer',
    minimum: 0,
    maximum: 2_147_483_647,
    default: 0,
  });
  expect(
    openApiSpec.components.schemas.StockAdjustmentRequest.properties.units,
  ).toMatchObject({ type: 'integer', minimum: 1, maximum: 2_147_483_647 });
  expect(
    openApiSpec.components.schemas.StockResponse.properties.availableUnits,
  ).toMatchObject({ type: 'integer', minimum: 0, maximum: 2_147_483_647 });
  expect(
    openApiSpec.components.schemas.StockAdjustmentResult.properties.stockId,
  ).toEqual({ type: 'string', example: 'STOCK-00001' });

  const searchParameters = openApiSpec.paths['/stock'].get.parameters;
  expect(
    searchParameters.find(({ name }) => name === 'isActive').schema,
  ).toEqual({ type: 'boolean' });
  expect(
    searchParameters.find(({ name }) => name === 'historical').schema,
  ).toEqual({ type: 'boolean', default: false });
  expect(
    openApiSpec.components.schemas.StockResponse.properties.endedAt,
  ).toEqual({ type: 'string', format: 'date-time', nullable: true });
  expect(
    openApiSpec.paths['/stock/{productId}/adjustments'].post.parameters[0]
      .schema,
  ).toEqual({ type: 'string', pattern: '^PROD-[0-9]{5,}$', maxLength: 32 });
});
