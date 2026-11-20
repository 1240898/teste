import { jest } from '@jest/globals';
import { getSection } from '../../src/app/navigation/navigationPolicy.js';

const businessPages = [
  ['catalogue', () => import('../../src/features/catalogue/CataloguePage.jsx')],
  [
    'customers',
    () =>
      import('../../src/features/business-management/customers/CustomersModule.jsx'),
  ],
  [
    'categories',
    () =>
      import('../../src/features/business-management/categories/CategoriesModule.jsx'),
  ],
  [
    'allergens',
    () =>
      import('../../src/features/business-management/allergens/AllergensModule.jsx'),
  ],
  [
    'products',
    () =>
      import('../../src/features/business-management/products/ProductsModule.jsx'),
  ],
  [
    'pizzaSizes',
    () =>
      import('../../src/features/business-management/pizza-sizes/PizzaSizesModule.jsx'),
  ],
  [
    'componentTypes',
    () =>
      import('../../src/features/business-management/component-types/ComponentTypesModule.jsx'),
  ],
  [
    'componentConfigurations',
    () =>
      import('../../src/features/business-management/component-configurations/ComponentConfigurationsModule.jsx'),
  ],
  [
    'stock',
    () =>
      import('../../src/features/business-management/stock/StockModule.jsx'),
  ],
  [
    'predefinedPizzas',
    () =>
      import('../../src/features/business-management/predefined-pizzas/PredefinedPizzasModule.jsx'),
  ],
];

test.each(businessPages)(
  'WEB05 registers the %s page module and its route is enabled for its declared role',
  async (id, loadPage) => {
    const module = await loadPage();
    expect(typeof module.default).toBe('function');

    const section = getSection(
      id === 'componentConfigurations' ? 'products' : id,
    );
    expect(section.enabled).toBe(true);
    expect(section.owner).toBe(id === 'catalogue' ? 'WEB03' : 'WEB05');
    if (id !== 'catalogue') expect(section.roles).toContain('MANAGER');
  },
);

test('component-size configuration is mounted under the product module and restricted to managers', () => {
  const products = getSection('products');
  const nested = products.children.find(
    ({ id }) => id === 'productComponentConfigurations',
  );
  expect(products.childPaths).toContain(':productId/component-configurations');
  expect(nested.roles).toEqual(['MANAGER']);
});

test('business page modules expose an adapter factory for the shared API client', async () => {
  const [
    customers,
    categories,
    allergens,
    products,
    sizes,
    types,
    configs,
    stock,
    pizzas,
  ] = await Promise.all([
    import('../../src/features/business-management/customers/customerApi.js'),
    import('../../src/features/business-management/categories/categoryApi.js'),
    import('../../src/features/business-management/allergens/allergenApi.js'),
    import('../../src/features/business-management/products/productApi.js'),
    import('../../src/features/business-management/pizza-sizes/pizzaSizeApi.js'),
    import('../../src/features/business-management/component-types/componentTypeApi.js'),
    import('../../src/features/business-management/component-configurations/componentConfigurationApi.js'),
    import('../../src/features/business-management/stock/stockApi.js'),
    import('../../src/features/business-management/predefined-pizzas/predefinedPizzaApi.js'),
  ]);

  for (const factory of [
    customers.createCustomerApi,
    categories.createCategoryApi,
    allergens.createAllergenApi,
    products.createProductApi,
    sizes.createPizzaSizeApi,
    types.createComponentTypeApi,
    configs.createComponentConfigurationApi,
    stock.createStockApi,
    pizzas.createPredefinedPizzaApi,
  ]) {
    expect(typeof factory).toBe('function');
    expect(factory(jest.fn())).toBeDefined();
  }
});

test.each([
  [
    'customers',
    () =>
      import('../../src/features/business-management/customers/customerDTO.js'),
    ['customerToForm', 'customerToPayload'],
  ],
  [
    'categories',
    () =>
      import('../../src/features/business-management/categories/categoryDTO.js'),
    ['categoryToPayload'],
  ],
  [
    'allergens',
    () =>
      import('../../src/features/business-management/allergens/allergenDTO.js'),
    ['allergenToPayload'],
  ],
  [
    'products',
    () =>
      import('../../src/features/business-management/products/productDTO.js'),
    ['productToForm', 'productToPayload'],
  ],
  [
    'pizza sizes',
    () =>
      import('../../src/features/business-management/pizza-sizes/pizzaSizeDTO.js'),
    ['pizzaSizeToForm', 'pizzaSizeToPayload'],
  ],
  [
    'component types',
    () =>
      import('../../src/features/business-management/component-types/componentTypeDTO.js'),
    ['componentTypeToPayload'],
  ],
  [
    'component-size configurations',
    () =>
      import('../../src/features/business-management/component-configurations/componentConfigurationDTO.js'),
    ['componentConfigurationToForm', 'componentConfigurationToPayload'],
  ],
  [
    'stock',
    () => import('../../src/features/business-management/stock/stockDTO.js'),
    ['stockStartToPayload', 'stockAdjustmentToPayload'],
  ],
  [
    'predefined pizzas',
    () =>
      import('../../src/features/business-management/predefined-pizzas/predefinedPizzaDTO.js'),
    [
      'predefinedPizzaToForm',
      'predefinedPizzaToPayload',
      'componentsToPayload',
    ],
  ],
])(
  'WEB05 %s DTO exposes its form/payload mappings',
  async (_area, loadDTO, exports) => {
    const dto = await loadDTO();
    for (const name of exports) expect(typeof dto[name]).toBe('function');
  },
);
