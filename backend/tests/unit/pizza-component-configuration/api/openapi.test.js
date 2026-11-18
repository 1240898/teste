import { openApiSpec } from '../../../../src/shared/openapi/spec.js';

const paths = openApiSpec.paths;

test.each([
  ['/products/{productId}/component-configurations/{sizeId}', 'post', 201],
  ['/products/{productId}/component-configurations/{sizeId}', 'patch', 200],
  ['/products/{productId}/component-configurations', 'get', 200],
])('documents %s %s with security and errors', (path, method, status) => {
  const operation = paths[path]?.[method];
  expect(operation).toBeDefined();
  expect(operation.responses[status]).toBeDefined();
  expect(operation.responses[400]).toBeDefined();
  expect(operation.responses[401]).toBeDefined();
  expect(operation.responses[403]).toBeDefined();
  expect(operation.responses[404]).toBeDefined();
  expect(operation.responses[409]).toBeDefined();
  expect(operation.responses[500]).toBeDefined();
  expect(operation.security).toEqual([{ bearerAuth: [] }, { accessToken: [] }]);
});

test('documents strict create/update DTOs and canonical response money', () => {
  expect(
    openApiSpec.components.schemas.ComponentConfigurationData.required,
  ).toEqual(['amount', 'currency', 'stockUnitsConsumed']);
  expect(
    openApiSpec.components.schemas.ComponentConfigurationUpdate.minProperties,
  ).toBe(1);
  expect(
    openApiSpec.components.schemas.ComponentConfigurationResponse.properties
      .amount,
  ).toMatchObject({
    type: 'string',
  });
  expect(
    openApiSpec.components.schemas.ComponentConfigurationResponse.properties
      .stockUnitsConsumed.nullable,
  ).toBe(true);
});
