import { openApiSpec } from '../../../src/shared/openapi/spec.js';

const operations = [
  ['/products', 'get', 200],
  ['/products', 'post', 201],
  ['/products/{id}', 'get', 200],
  ['/products/{id}', 'put', 200],
  ['/products/{id}', 'delete', 204],
  ['/products/{id}/activate', 'patch', 200],
];
test.each(operations)(
  'documents %s %s with its contract',
  (path, method, status) => {
    const operation = openApiSpec.paths[path]?.[method];
    expect(operation).toBeDefined();
    expect(operation.responses[status]).toBeDefined();
    for (const code of [401, 403, 500])
      expect(operation.responses[code]).toBeDefined();
    if (method === 'get') expect(operation.security).toEqual([]);
    else
      expect(operation.security).toEqual([
        { bearerAuth: [] },
        { accessToken: [] },
      ]);
  },
);
test('documents acquisition and composition without exposing stock fields on Product', () => {
  expect(openApiSpec.paths['/products/{id}'].put.responses[409]).toBeDefined();
  expect(
    openApiSpec.paths['/products'].get.parameters.map((p) => p.name),
  ).toEqual([
    'name',
    'categoryId',
    'isSellable',
    'isPizzaComponent',
    'isActive',
    'acquisitionType',
    'pizzaComponentTypeId',
    'excludeAllergenIds',
  ]);
  const response = openApiSpec.components.schemas.ProductResponse.properties;
  expect(response.availableUnits).toBeUndefined();
  expect(response.initialUnits).toBeUndefined();
  expect(response.isStockControlled).toBeUndefined();
  expect(response.acquisitionType).toMatchObject({
    type: 'string',
    enum: ['PRODUCED', 'PURCHASED'],
  });
  expect(response.compositionItems.description).toMatch(/summ?ing their quantities/i);
  expect(response.compositionItems.uniqueItems).toBeUndefined();
  expect(
    openApiSpec.components.schemas.ProductRequest.properties.isActive,
  ).toBeUndefined();
});
test('every $ref resolves to a component schema', () => {
  const refs = [
    ...JSON.stringify(openApiSpec).matchAll(/#\/components\/schemas\/(\w+)/g),
  ];
  for (const [, name] of refs)
    expect(openApiSpec.components.schemas[name]).toBeDefined();
});
