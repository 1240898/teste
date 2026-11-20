import { jest } from '@jest/globals';
import { createAllergenApi } from '../../src/features/business-management/allergens/allergenApi.js';
import { createCategoryApi } from '../../src/features/business-management/categories/categoryApi.js';
import { createCustomerApi } from '../../src/features/business-management/customers/customerApi.js';
import { customerToPayload } from '../../src/features/business-management/customers/customerDTO.js';
import { createProductApi } from '../../src/features/business-management/products/productApi.js';
import { productToPayload } from '../../src/features/business-management/products/productDTO.js';
import { createPizzaSizeApi } from '../../src/features/business-management/pizza-sizes/pizzaSizeApi.js';
import { createComponentTypeApi } from '../../src/features/business-management/component-types/componentTypeApi.js';
import { createComponentConfigurationApi } from '../../src/features/business-management/component-configurations/componentConfigurationApi.js';
import { componentConfigurationToPayload } from '../../src/features/business-management/component-configurations/componentConfigurationDTO.js';
import { createStockApi } from '../../src/features/business-management/stock/stockApi.js';
import { createPredefinedPizzaApi } from '../../src/features/business-management/predefined-pizzas/predefinedPizzaApi.js';
import { predefinedPizzaToPayload } from '../../src/features/business-management/predefined-pizzas/predefinedPizzaDTO.js';

test('category, allergen, size and component-type adapters use their REST contracts', async () => {
  const request = jest.fn().mockResolvedValue({});
  await createCategoryApi(request).create({ name: 'Categoria' });
  await createAllergenApi(request).update(7, { name: 'Leite' });
  await createPizzaSizeApi(request).create({ name: 'Pequena', extra: true });
  await createComponentTypeApi(request).create({
    name: 'Base',
    assemblyOrder: 1,
    minQuantity: 1,
    maxQuantity: 1,
  });

  expect(request.mock.calls).toEqual([
    ['POST', '/categories', { body: { name: 'Categoria' } }],
    ['PUT', '/allergens/7', { body: { name: 'Leite' } }],
    ['POST', '/pizza-sizes', { body: { name: 'Pequena' } }],
    [
      'POST',
      '/pizza-component-types',
      {
        body: {
          name: 'Base',
          assemblyOrder: 1,
          minQuantity: 1,
          maxQuantity: 1,
        },
      },
    ],
  ]);
});

test('customer adapter serializes dietary restrictions and targets customer activation routes', async () => {
  const request = jest.fn().mockResolvedValue({});
  const api = createCustomerApi(request);
  const payload = customerToPayload({
    name: 'Cliente teste',
    email: 'cliente@example.com',
    phoneNumber: '+351910000001',
    dietaryRestrictions: JSON.stringify([
      { name: 'Sem lactose', allergenId: 7 },
    ]),
    userId: '',
  });
  await api.create(payload);
  await api.deactivate('CUST-0001');

  expect(request).toHaveBeenNthCalledWith(1, 'POST', '/customers', {
    body: {
      name: 'Cliente teste',
      email: 'cliente@example.com',
      phoneNumber: '+351910000001',
      dietaryRestrictions: [{ name: 'Sem lactose', allergenId: 7 }],
    },
  });
  expect(request).toHaveBeenNthCalledWith(
    2,
    'PATCH',
    '/customers/CUST-0001/deactivate',
  );
});

test('product adapter requests references and derives allergens from component composition', async () => {
  const request = jest.fn(async (method, path) => {
    if (path === '/products')
      return [
        {
          id: 'PROD-00002',
          name: 'Pizza teste',
          compositionItems: [{ productId: 'PROD-00001', quantity: 1 }],
          allergenIds: [],
        },
      ];
    if (path === '/products/PROD-00001')
      return { id: 'PROD-00001', allergenIds: [7], compositionItems: [] };
    return [];
  });
  const api = createProductApi(request);
  const products = await api.list({ name: 'Pizza teste' });

  expect(request).toHaveBeenCalledWith('GET', '/products', {
    query: { name: 'Pizza teste' },
    signal: undefined,
  });
  expect(products[0].derivedAllergenIds).toEqual([7]);
});

test('product refresh reads fresh component allergen references', async () => {
  let childAllergen = 1;
  const request = jest.fn(async (_method, path) => {
    if (path === '/products')
      return [
        {
          id: 'PROD-00002',
          name: 'Pizza teste',
          compositionItems: [{ productId: 'PROD-00001', quantity: 1 }],
          allergenIds: [],
        },
      ];
    if (path === '/products/PROD-00001')
      return {
        id: 'PROD-00001',
        allergenIds: [childAllergen],
        compositionItems: [],
      };
    return [];
  });
  const api = createProductApi(request);

  expect((await api.list({}))[0].derivedAllergenIds).toEqual([1]);
  childAllergen = 7;
  expect((await api.list({}))[0].derivedAllergenIds).toEqual([7]);
  expect(
    request.mock.calls.filter(([, path]) => path === '/products/PROD-00001'),
  ).toHaveLength(2);
});

test('predefined-pizza adapter distinguishes missing catalogue offers from failures', async () => {
  const request = jest.fn(async (_method, path) => {
    if (path === '/predefined-pizzas')
      return [
        { id: 'PROD-00010', componentIds: ['PROD-00001'] },
        { id: 'PROD-00011', componentIds: ['PROD-00001'] },
      ];
    if (path === '/products')
      return [{ id: 'PROD-00001', allergenIds: [7] }];
    // Catalogue: no offer for PROD-00010, failure for PROD-00011.
    if (path === '/catalogue/PROD-00010')
      throw Object.assign(new Error('missing'), { status: 404, kind: 'http' });
    if (path === '/catalogue/PROD-00011')
      throw Object.assign(new Error('service unavailable'), {
        status: 503,
        kind: 'http',
      });
    // After the 404 the adapter reads the product: it exists and is active.
    if (path === '/products/PROD-00010')
      return { id: 'PROD-00010', isActive: true, isSellable: true };
    return [];
  });
  const pizzas = await createPredefinedPizzaApi(request).list();

  expect(pizzas.map(({ offerStatus }) => offerStatus)).toEqual([
    'notOffered',
    'error',
  ]);
  expect(pizzas[0].components[0].allergenIds).toEqual([7]);
  // A catalogue failure (503) is not followed by a product lookup.
  expect(
    request.mock.calls.some(([, path]) => path === '/products/PROD-00011'),
  ).toBe(false);
});

test('product DTO parses JSON fields and normalizes numbers and flags', () => {
  expect(
    productToPayload({
      name: '  Pizza  ',
      description: ' teste ',
      categoryId: ' CAT-00001 ',
      isSellable: true,
      isPizzaComponent: false,
      acquisitionType: 'PRODUCED',
      compositionItems: '[{"productId":"PROD-00001","quantity":"2"}]',
      pizzaComponentTypeId: '',
      allergenIds: ['7'],
      pricingMode: 'FIXED',
      basePrice: '2.5',
    }),
  ).toEqual({
    name: 'Pizza',
    description: 'teste',
    categoryId: 'CAT-00001',
    isSellable: true,
    isPizzaComponent: false,
    acquisitionType: 'PRODUCED',
    compositionItems: [{ productId: 'PROD-00001', quantity: 2 }],
    pizzaComponentTypeId: null,
    allergenIds: [7],
    pricingMode: 'FIXED',
    basePrice: 2.5,
  });
});

test('configuration, stock and predefined-pizza adapters preserve resource identity and payloads', async () => {
  const request = jest.fn().mockResolvedValue([]);
  const configuration = createComponentConfigurationApi(request);
  const stock = createStockApi(request);
  const pizzas = createPredefinedPizzaApi(request);

  await configuration.create({
    productId: 'PROD-00001',
    sizeId: 'SIZE-01',
    amount: '1.00',
    currency: 'EUR',
    stockUnitsConsumed: 1,
  });
  await stock.adjust('PROD-00001', { direction: 'INCREASE', units: 2 });
  await pizzas.create({
    productId: 'PROD-00002',
    componentIds: ['PROD-00001'],
  });

  expect(request).toHaveBeenNthCalledWith(
    1,
    'POST',
    '/products/PROD-00001/component-configurations/SIZE-01',
    { body: { amount: '1.00', currency: 'EUR', stockUnitsConsumed: 1 } },
  );
  expect(request).toHaveBeenNthCalledWith(
    2,
    'POST',
    '/stock/PROD-00001/adjustments',
    { body: { direction: 'INCREASE', units: 2 } },
  );
  expect(request).toHaveBeenNthCalledWith(
    3,
    'POST',
    '/predefined-pizzas',
    { body: { productId: 'PROD-00002', componentIds: ['PROD-00001'] } },
  );
});

test('configuration and predefined-pizza DTOs map form strings to API payloads', () => {
  expect(
    componentConfigurationToPayload(
      {
        productId: ' PROD-00001 ',
        sizeId: ' SIZE-01 ',
        amount: ' 1.25 ',
        currency: ' EUR ',
        stockUnitsConsumed: '2',
      },
      false,
    ),
  ).toEqual({
    productId: 'PROD-00001',
    sizeId: 'SIZE-01',
    amount: '1.25',
    currency: 'EUR',
    stockUnitsConsumed: 2,
  });
  expect(
    predefinedPizzaToPayload({
      productId: ' PROD-00002 ',
      componentIds: '["PROD-00001"]',
    }),
  ).toEqual({
    productId: 'PROD-00002',
    componentIds: ['PROD-00001'],
  });
});
