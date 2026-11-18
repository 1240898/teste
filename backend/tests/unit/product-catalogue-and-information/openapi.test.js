import {
  cataloguePaths,
  catalogueSchemas,
} from '../../../src/modules/product-catalogue-and-information/api/openapi.js';

describe('BCK11 OpenAPI contract', () => {
  test('WEB03 (ALN-1): catalogue listing and details are public', () => {
    for (const path of ['/catalogue', '/catalogue/{productId}']) {
      expect(cataloguePaths[path].get.security).toEqual([]);
      expect(cataloguePaths[path].get.responses).not.toHaveProperty('401');
    }
  });

  test('documents exact case-insensitive full component-name search', () => {
    const parameter = cataloguePaths['/catalogue'].get.parameters.find(
      ({ name }) => name === 'componentName',
    );

    expect(parameter.required).toBe(false);
    expect(parameter.description).toMatch(
      /exact full component name.*case-insensitive/i,
    );
  });

  test('defines nullable price and pizza fields in the catalogue DTO', () => {
    expect(catalogueSchemas.CatalogueProduct.properties.price.nullable).toBe(
      true,
    );
    expect(catalogueSchemas.CatalogueProduct.properties.pizza.nullable).toBe(
      true,
    );
  });
});
