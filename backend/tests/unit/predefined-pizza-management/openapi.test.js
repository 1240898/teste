import { openApiSpec } from '../../../src/shared/openapi/spec.js';

describe('BCK10 OpenAPI manager contracts', () => {
  test('documents only the four Manager management workflows and business IDs', () => {
    const paths = openApiSpec.paths;
    expect(paths['/predefined-pizzas'].post.operationId).toBe(
      'createPredefinedPizza',
    );
    expect(paths['/predefined-pizzas'].get.operationId).toBe(
      'listPredefinedPizzas',
    );
    expect(paths['/predefined-pizzas/{productId}'].get.operationId).toBe(
      'getPredefinedPizza',
    );
    expect(
      paths['/predefined-pizzas/{productId}/default-configuration'].put
        .operationId,
    ).toBe('replaceDefaultPizzaConfiguration');
    expect(paths['/predefined-pizzas'].post.security).toEqual([
      { bearerAuth: [] },
      { accessToken: [] },
    ]);
    expect(
      openApiSpec.components.schemas.PredefinedPizzaResponse.properties.id.type,
    ).toBe('string');
    expect(
      JSON.stringify(openApiSpec.components.schemas.PredefinedPizzaResponse),
    ).not.toMatch(/price|availability|stock/i);
    expect(paths['/predefined-pizzas'].get.parameters).toBeUndefined();
  });
});
