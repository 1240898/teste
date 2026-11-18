import { openApiSpec } from '../../../src/shared/openapi/spec.js';

test.each([
  ['/pizza-component-types', 'get', 200],
  ['/pizza-component-types', 'post', 201],
  ['/pizza-component-types/{id}', 'get', 200],
  ['/pizza-component-types/{id}', 'patch', 200],
  ['/pizza-component-types/{id}', 'delete', 204],
])('documents %s %s with its response contract', (path, method, status) => {
  const operation = openApiSpec.paths[path]?.[method];
  expect(operation).toBeDefined();
  expect(operation.responses[status]).toBeDefined();
  expect(operation.responses[500]).toBeDefined();
  expect(operation.security).toEqual([{ bearerAuth: [] }, { accessToken: [] }]);
});

test('documents exact case-insensitive OR search and list-all behavior', () => {
  const search = openApiSpec.paths['/pizza-component-types'].get;
  expect(search.description).toMatch(/exact.*case-insensitive/i);
  expect(search.description).toMatch(/both id and name.*either/i);
  expect(search.description).toMatch(/neither.*all/i);
  expect(search.parameters.map((parameter) => parameter.name)).toEqual([
    'id',
    'name',
  ]);
});
