import { jest } from '@jest/globals';
import { CatalogueNotFoundError } from '../../../src/modules/product-catalogue-and-information/application/CatalogueNotFoundError.js';
import { CatalogueService } from '../../../src/modules/product-catalogue-and-information/application/CatalogueService.js';
import { ProductId } from '../../../src/modules/product-management/domain/model/ProductId.js';
import {
  allergen,
  category,
  componentConfiguration,
  facts,
  predefinedPizza,
  product,
  size,
} from '../../helpers/catalogueFixtures.js';

function catalogueContext() {
  const component = product({
    id: 'PROD-00002',
    name: 'Mozzarella Cheese',
    component: true,
    componentTypeId: 'type-03',
    allergenIds: [7],
  });
  const pizza = product({
    id: 'PROD-00003',
    name: 'Margherita',
    pricingMode: 'COMPONENT_BASED',
    price: null,
  });
  const hiddenComponent = product({
    id: 'PROD-00004',
    name: 'Hidden Mozzarella',
    sellable: false,
    component: true,
    componentTypeId: 'type-03',
    allergenIds: [7],
    pricingMode: null,
    price: null,
  });
  const other = product({ id: 'PROD-00005', name: 'Garlic Bread' });
  const small = size();
  const allFacts = facts({
    roots: [component, pizza, other],
    products: [component, pizza, hiddenComponent, other],
    categories: [category()],
    allergens: [allergen({ id: 7, name: 'Milk' })],
    pizzas: [
      predefinedPizza({
        productId: pizza.getId().getValue(),
        componentIds: [hiddenComponent.getId().getValue()],
      }),
    ],
    configurations: [
      componentConfiguration({
        component: hiddenComponent,
        size: small,
        price: '2.50',
      }),
    ],
    sizes: [small],
  });
  const reader = {
    loadSellable: jest.fn().mockResolvedValue(allFacts),
    loadFor: jest.fn().mockResolvedValue(allFacts),
  };
  const service = new CatalogueService({ reader });
  return { service, reader, component, pizza, other, hiddenComponent };
}

describe('CatalogueService', () => {
  test('lists every sellable product and maps domain entries to DTOs', async () => {
    const { service } = catalogueContext();

    const result = await service.list();

    expect(result.map(({ id }) => id)).toEqual([
      'PROD-00002',
      'PROD-00003',
      'PROD-00005',
    ]);
    expect(result[1]).toMatchObject({
      name: 'Margherita',
      price: null,
      pizza: {
        defaultComponents: [
          {
            id: 'PROD-00004',
            name: 'Hidden Mozzarella',
            pizzaComponentTypeId: 'type-03',
          },
        ],
        sizes: [
          {
            sizeName: 'Small',
            price: { amount: '2.50', currency: 'EUR' },
            available: true,
          },
        ],
      },
    });
  });

  test('searches exact component names case-insensitively on products and pizzas', async () => {
    const { service, reader } = catalogueContext();

    const result = await service.list({ componentName: 'hIdDeN mOzzarella' });

    expect(result.map(({ id }) => id)).toEqual(['PROD-00003']);
    expect(reader.loadSellable).toHaveBeenCalledTimes(1);
  });

  test('does not treat a partial component name as a match', async () => {
    const { service } = catalogueContext();

    await expect(
      service.list({ componentName: 'Mozzarella' }),
    ).resolves.toEqual([]);
  });

  test('requires all selected components and excludes any selected component or allergen', async () => {
    const { service } = catalogueContext();

    await expect(
      service.list({ componentIds: 'PROD-00004' }),
    ).resolves.toMatchObject([{ id: 'PROD-00003' }]);
    await expect(
      service.list({ componentIds: 'PROD-00004,PROD-00002' }),
    ).resolves.toEqual([]);
    await expect(
      service.list({ excludeComponentIds: 'PROD-00004' }),
    ).resolves.toMatchObject([{ id: 'PROD-00002' }, { id: 'PROD-00005' }]);
    await expect(
      service.list({ excludeAllergenIds: '7' }),
    ).resolves.toMatchObject([{ id: 'PROD-00005' }]);
  });

  test('returns an inactive sellable product by id with unavailable status', async () => {
    const { service, reader } = catalogueContext();
    const inactive = product({
      id: 'PROD-00006',
      name: 'Inactive',
      active: false,
    });
    const inactiveFacts = facts({
      roots: [inactive],
      products: [inactive],
      categories: [category()],
    });
    reader.loadFor.mockResolvedValue(inactiveFacts);

    const result = await service.getById(inactive.getId());

    expect(result).toMatchObject({ id: 'PROD-00006', available: false });
  });

  test('maps absent or non-sellable product detail to not found', async () => {
    const { service, reader } = catalogueContext();
    reader.loadFor.mockResolvedValue(facts({ roots: [] }));

    await expect(
      service.getById(ProductId.create('PROD-99999')),
    ).rejects.toThrow(CatalogueNotFoundError);
  });
});
