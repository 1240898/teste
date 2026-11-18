import { InvalidCatalogueData } from '../../../src/modules/product-catalogue-and-information/domain/InvalidCatalogueData.js';
import { CataloguePolicy } from '../../../src/modules/product-catalogue-and-information/domain/CataloguePolicy.js';
import {
  allergen,
  category,
  componentConfiguration,
  facts,
  predefinedPizza,
  product,
  size,
  stock,
} from '../../helpers/catalogueFixtures.js';

const policy = new CataloguePolicy();

describe('CataloguePolicy', () => {
  test('excludes a non-sellable product as a catalogue root', () => {
    const component = product({
      id: 'PROD-00002',
      sellable: false,
      component: true,
      pricingMode: null,
      price: null,
    });

    expect(
      policy.evaluate(component, facts({ roots: [component] })),
    ).toBeNull();
  });

  test('projects maintained names, fixed price, category and allergens', () => {
    const item = product({ allergenIds: [1] });
    const foodAllergen = allergen();
    const itemCategory = category();
    const result = policy.evaluate(
      item,
      facts({
        roots: [item],
        categories: [itemCategory],
        allergens: [foodAllergen],
      }),
    );

    expect(result.available).toBe(true);
    expect(result.category).toBe(itemCategory);
    expect(result.allergens).toEqual([foodAllergen]);
    expect(result.price.getAmount()).toBe(4.25);
  });

  test('keeps an inactive sellable product and marks it unavailable', () => {
    const item = product({ active: false });
    const result = policy.evaluate(
      item,
      facts({ roots: [item], categories: [category()] }),
    );

    expect(result).not.toBeNull();
    expect(result.available).toBe(false);
  });

  test('marks a currently tracked Product unavailable at zero stock', () => {
    const item = product();
    const result = policy.evaluate(
      item,
      facts({
        roots: [item],
        categories: [category()],
        stockRecords: [stock({ units: 0 })],
      }),
    );

    expect(result.available).toBe(false);
  });

  test('does not constrain availability when the Product has no current tracking period', () => {
    const item = product();

    const result = policy.evaluate(
      item,
      facts({ roots: [item], categories: [category()] }),
    );
    expect(result.available).toBe(true);
  });

  test('rejects a sellable product with neither a fixed price nor a pizza', () => {
    const pizza = product({
      pricingMode: 'COMPONENT_BASED',
      price: null,
    });

    expect(() =>
      policy.evaluate(
        pizza,
        facts({ roots: [pizza], categories: [category()] }),
      ),
    ).toThrow(InvalidCatalogueData);
  });

  test('rejects a product that has both a fixed price and a predefined pizza', () => {
    const item = product();
    const component = product({
      id: 'PROD-00002',
      sellable: false,
      component: true,
      pricingMode: null,
      price: null,
    });

    expect(() =>
      policy.evaluate(
        item,
        facts({
          roots: [item],
          products: [item, component],
          categories: [category()],
          pizzas: [
            predefinedPizza({
              componentIds: [component.getId().getValue()],
            }),
          ],
        }),
      ),
    ).toThrow(InvalidCatalogueData);
  });

  test('sums component prices and derives distinct allergens by size', () => {
    const pizza = product({
      pricingMode: 'COMPONENT_BASED',
      price: null,
      allergenIds: [],
    });
    const dough = product({
      id: 'PROD-00002',
      name: 'Dough',
      sellable: false,
      component: true,
      pricingMode: null,
      price: null,
      allergenIds: [1],
    });
    const cheese = product({
      id: 'PROD-00003',
      name: 'Cheese',
      sellable: false,
      component: true,
      pricingMode: null,
      price: null,
      allergenIds: [1, 7],
    });
    const small = size();
    const large = size({ id: 'PSIZE-0002', name: 'Large' });
    const gluten = allergen();
    const milk = allergen({ id: 7, name: 'Milk' });
    const result = policy.evaluate(
      pizza,
      facts({
        roots: [pizza],
        products: [pizza, dough, cheese],
        categories: [category()],
        allergens: [gluten, milk],
        pizzas: [
          predefinedPizza({
            componentIds: [dough.getId().getValue(), cheese.getId().getValue()],
          }),
        ],
        configurations: [
          componentConfiguration({
            component: dough,
            size: small,
            price: '3.00',
            consumed: 1,
          }),
          componentConfiguration({
            component: cheese,
            size: small,
            price: '2.25',
          }),
          componentConfiguration({
            component: dough,
            size: large,
            price: '5.00',
            consumed: 3,
          }),
          componentConfiguration({
            component: cheese,
            size: large,
            price: '3.75',
          }),
        ],
        stockRecords: [
          stock({ productId: dough.getId().getValue(), units: 2 }),
        ],
        sizes: [small, large],
      }),
    );

    expect(result.allergens).toEqual([gluten, milk]);
    expect(
      result.sizes.map(({ price, available }) => [
        price.getAmount(),
        available,
      ]),
    ).toEqual([
      [5.25, true],
      [8.75, false],
    ]);
  });

  test('treats a pizza total outside the BCK05 Money range as corrupt catalogue data', () => {
    const pizza = product({ pricingMode: 'COMPONENT_BASED', price: null });
    const first = product({
      id: 'PROD-00002',
      sellable: false,
      component: true,
      pricingMode: null,
      price: null,
    });
    const second = product({
      id: 'PROD-00003',
      componentTypeId: 'type-02',
      sellable: false,
      component: true,
      pricingMode: null,
      price: null,
    });
    const small = size();

    expect(() =>
      policy.evaluate(
        pizza,
        facts({
          roots: [pizza],
          products: [pizza, first, second],
          categories: [category()],
          pizzas: [
            predefinedPizza({
              componentIds: [
                first.getId().getValue(),
                second.getId().getValue(),
              ],
            }),
          ],
          configurations: [
            componentConfiguration({
              component: first,
              size: small,
              price: '60000000.00',
            }),
            componentConfiguration({
              component: second,
              size: small,
              price: '60000000.00',
            }),
          ],
          sizes: [small],
        }),
      ),
    ).toThrow(InvalidCatalogueData);
  });

  test('retains an inactive size as unavailable and omits unsupported sizes', () => {
    const pizza = product({ pricingMode: 'COMPONENT_BASED', price: null });
    const component = product({
      id: 'PROD-00002',
      sellable: false,
      component: true,
      pricingMode: null,
      price: null,
    });
    const active = size();
    const inactive = size({ id: 'PSIZE-0002', name: 'Large', active: false });
    const unsupported = size({ id: 'PSIZE-0003', name: 'Family' });
    const result = policy.evaluate(
      pizza,
      facts({
        roots: [pizza],
        products: [pizza, component],
        categories: [category()],
        pizzas: [
          predefinedPizza({ componentIds: [component.getId().getValue()] }),
        ],
        configurations: [
          componentConfiguration({ component, size: active, price: '3.00' }),
          componentConfiguration({ component, size: inactive, price: '5.00' }),
        ],
        sizes: [active, inactive, unsupported],
      }),
    );

    expect(
      result.sizes.map(({ sizeName, available }) => [sizeName, available]),
    ).toEqual([
      ['Small', true],
      ['Large', false],
    ]);
  });
});
