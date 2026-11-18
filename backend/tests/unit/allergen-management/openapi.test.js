import { openApiSpec } from '../../../src/shared/openapi/spec.js';

const operations = [
  ['/allergens', 'get', 200, true],
  ['/allergens', 'post', 201, false],
  ['/allergens/{id}', 'get', 200, true],
  ['/allergens/{id}', 'put', 200, false],
  ['/allergens/{id}', 'delete', 204, false],
];
test.each(operations)(
  'documents %s %s with its success and error contract',
  (path, method, status, isPublic) => {
    const operation = openApiSpec.paths[path]?.[method];
    expect(operation).toBeDefined();
    expect(operation.responses[status]).toBeDefined();
    expect(operation.responses[500]).toBeDefined();
    if (isPublic) expect(operation.security).toEqual([]);
    else {
      expect(operation.security).toEqual([
        { bearerAuth: [] },
        { accessToken: [] },
      ]);
      expect(operation.responses[401]).toBeDefined();
      expect(operation.responses[403]).toBeDefined();
    }
  },
);
test('documents 409 on conflicting writes, the 1..14 id range and search parameters', () => {
  expect(openApiSpec.paths['/allergens'].post.responses[409]).toBeDefined();
  expect(
    openApiSpec.paths['/allergens/{id}'].delete.responses[409],
  ).toBeDefined();
  expect(
    openApiSpec.components.schemas.RegisterAllergenRequest.properties.id,
  ).toMatchObject({ type: 'integer', minimum: 1, maximum: 14 });
  expect(
    openApiSpec.paths['/allergens'].get.parameters.map((p) => p.name),
  ).toEqual(['name', 'id']);
});
test('every $ref resolves to a component schema', () => {
  const refs = [
    ...JSON.stringify(openApiSpec).matchAll(/#\/components\/schemas\/(\w+)/g),
  ];
  for (const [, name] of refs)
    expect(openApiSpec.components.schemas[name]).toBeDefined();
});