import { AllergenId } from '../../../src/modules/allergen-management/domain/model/AllergenId.js';
import { CategoryId } from '../../../src/modules/product-category-management/domain/model/CategoryId.js';
import { ComponentTypeId } from '../../../src/modules/pizza-component-type-management/domain/model/values.js';
import { Money } from '../../../src/modules/product-management/domain/model/Money.js';
import { AcquisitionType } from '../../../src/modules/product-management/domain/model/AcquisitionType.js';
import { PricingMode } from '../../../src/modules/product-management/domain/model/PricingMode.js';
import {
  Product,
  PizzaComponent,
  PredefinedPizza,
  SellableProduct,
} from '../../../src/modules/product-management/domain/model/Product.js';
import { ProductCompositionItem } from '../../../src/modules/product-management/domain/model/ProductCompositionItem.js';
import { ProductDescription } from '../../../src/modules/product-management/domain/model/ProductDescription.js';
import { ProductId } from '../../../src/modules/product-management/domain/model/ProductId.js';
import { ProductName } from '../../../src/modules/product-management/domain/model/ProductName.js';
import { Quantity } from '../../../src/modules/product-management/domain/model/Quantity.js';
import { ProductSearchCriteria } from '../../../src/modules/product-management/domain/search/ProductSearchCriteria.js';

const id = ProductId.create('PROD-00001');
const props = (overrides = {}) => ({
  name: ProductName.create('Coca-Cola 33cl'),
  description: ProductDescription.create('Soft drink can'),
  categoryId: CategoryId.create('CAT-00001'),
  isSellable: true,
  isPizzaComponent: false,
  acquisitionType: AcquisitionType.PURCHASED,
  compositionItems: [],
  pizzaComponentTypeId: null,
  allergenIds: [],
  pricingMode: PricingMode.FIXED,
  basePrice: Money.create(1.5),
  ...overrides,
});
const component = (overrides = {}) =>
  props({
    isSellable: false,
    isPizzaComponent: true,
    acquisitionType: AcquisitionType.PRODUCED,
    pizzaComponentTypeId: ComponentTypeId.create('type-03'),
    pricingMode: null,
    basePrice: null,
    ...overrides,
  });
const compositionItem = (productId, quantity) =>
  ProductCompositionItem.create(productId, Quantity.create(quantity));
const rejects = (overrides, message) =>
  expect(() => Product.create(id, props(overrides))).toThrow(message);

describe('BCK05 Product value objects', () => {
  test('identifiers and descriptive values validate and normalize', () => {
    expect(ProductId.create(' prod-00123 ').getValue()).toBe('PROD-00123');
    expect(() => ProductId.create('PROD-12')).toThrow('Invalid product id');
    expect(ProductName.create('  Mozzarella ').getValue()).toBe('Mozzarella');
    expect(() => ProductName.create('   ')).toThrow('cannot be empty');
    expect(ProductDescription.create('Fresh cheese').getValue()).toBe('Fresh cheese');
    expect(() => ProductDescription.create('')).toThrow('cannot be empty');
    expect(AcquisitionType.from('PURCHASED')).toBe('PURCHASED');
    expect(() => AcquisitionType.from('UNKNOWN')).toThrow('acquisition type');
  });

  test('Money keeps EUR amounts in exact cents', () => {
    expect(Money.sum([Money.create(0.1), Money.create(0.2)]).getAmount()).toBe(0.3);
    expect(Money.create(0).getCurrency()).toBe('EUR');
    expect(() => Money.create(1.005)).toThrow('2 decimal');
  });

  test('Quantity and composition items require positive integer quantities and product IDs', () => {
    expect(compositionItem('PROD-00002', 3).getQuantity().getAmount()).toBe(3);
    expect(() => Quantity.create(0)).toThrow('positive integer');
    expect(() => compositionItem('PROD-00002', 1.5)).toThrow('positive integer');
  });
});

describe('BCK05 Product aggregate', () => {
  test('materializes the sellable, component and predefined pizza classifications', () => {
    expect(Product.create(id, props())).toBeInstanceOf(SellableProduct);
    expect(Product.create(id, component())).toBeInstanceOf(PizzaComponent);
    const dual = Product.create(
      id,
      props({
        isPizzaComponent: true,
        pizzaComponentTypeId: ComponentTypeId.create('type-03'),
      }),
    );
    expect(dual).toBeInstanceOf(SellableProduct);
    expect(dual).toBeInstanceOf(PizzaComponent);
    expect(
      Product.create(
        id,
        props({ pricingMode: PricingMode.COMPONENT_BASED, basePrice: null }),
      ),
    ).toBeInstanceOf(PredefinedPizza);
  });

  test('requires at least one product classification and exactly one component type when applicable', () => {
    rejects(
      { isSellable: false, pricingMode: null, basePrice: null },
      'sellable, a pizza component, or both',
    );
    expect(() => Product.create(id, component({ pizzaComponentTypeId: null })))
      .toThrow('requires a pizza component type');
    rejects(
      { pizzaComponentTypeId: ComponentTypeId.create('type-01') },
      'Only pizza components',
    );
  });

  test('validates sellable pricing and prohibits pricing on non-sellable products', () => {
    rejects({ basePrice: null }, 'require a base price');
    rejects({ pricingMode: null }, 'require a pricing mode');
    expect(() => Product.create(id, component({ basePrice: Money.create(1) })))
      .toThrow('Non-sellable');
    expect(() => Product.create(id, component({ pricingMode: PricingMode.FIXED })))
      .toThrow('Non-sellable');
    expect(() =>
      Product.create(
        id,
        component({ isSellable: true, pricingMode: PricingMode.COMPONENT_BASED }),
      ),
    ).toThrow('cannot have a component-based price');
  });

  test('normalizes repeated composition products by summing quantities', () => {
    const product = Product.create(
      id,
      props({
        compositionItems: [
          compositionItem('PROD-00002', 2),
          compositionItem('PROD-00003', 1),
          compositionItem('PROD-00002', 3),
        ],
      }),
    );
    expect(
      product.getCompositionItems().map((item) => [
        item.getProductId().getValue(),
        item.getQuantity().getAmount(),
      ]),
    ).toEqual([
      ['PROD-00002', 5],
      ['PROD-00003', 1],
    ]);
  });

  test('applies the same composition normalization on revision and rejects overflow', () => {
    const product = Product.create(id, props());
    product.revise(
      props({
        compositionItems: [
          compositionItem('PROD-00002', 2),
          compositionItem('PROD-00002', 3),
        ],
      }),
    );
    expect(product.getCompositionItems()).toHaveLength(1);
    expect(product.getCompositionItems()[0].getQuantity().getAmount()).toBe(5);
    expect(() =>
      product.revise(
        props({
          compositionItems: [
            compositionItem('PROD-00002', 2_147_483_647),
            compositionItem('PROD-00002', 1),
          ],
        }),
      ),
    ).toThrow('positive integer');
  });

  test('allergens are optional and duplicates are rejected', () => {
    const product = Product.create(
      id,
      props({ allergenIds: [AllergenId.create(7), AllergenId.create(1)] }),
    );
    expect(product.getAllergenIds().map((allergen) => allergen.getValue())).toEqual([1, 7]);
    rejects(
      { allergenIds: [AllergenId.create(7), AllergenId.create(7)] },
      'must not be repeated',
    );
  });

  test('restore recreates the product and its composition', () => {
    const restored = Product.restore({
      id: 'PROD-00009',
      name: 'Margherita',
      description: 'Predefined pizza',
      categoryId: 'CAT-00002',
      isSellable: true,
      isPizzaComponent: false,
      acquisitionType: 'PRODUCED',
      compositionItems: [
        { productId: 'PROD-00002', quantity: 2 },
        { productId: 'PROD-00002', quantity: 3 },
      ],
      isActive: false,
      pizzaComponentTypeId: null,
      allergenIds: [1, 7],
      pricingMode: 'COMPONENT_BASED',
      basePrice: null,
      createdAt: new Date('2026-10-01T10:00:00Z'),
      updatedAt: new Date('2026-10-02T10:00:00Z'),
    });
    expect(restored).toBeInstanceOf(PredefinedPizza);
    expect(restored.isActive()).toBe(false);
    expect(restored.getCompositionItems()[0].getQuantity().getAmount()).toBe(5);
  });

  test('activation and deactivation are idempotent', () => {
    const product = Product.create(id, props());
    product.deactivate();
    const changedAt = product.updatedAt.getTime();
    product.deactivate();
    expect(product.isActive()).toBe(false);
    expect(product.updatedAt.getTime()).toBe(changedAt);
    product.activate();
    expect(product.isActive()).toBe(true);
  });
});

describe('BCK05 ProductSearchCriteria', () => {
  test('keeps valid filters and de-duplicates excluded allergens', () => {
    const criteria = new ProductSearchCriteria({
      name: '  mozz ',
      isActive: true,
      acquisitionType: 'PURCHASED',
      excludeAllergenIds: [AllergenId.create(1), AllergenId.create(1)],
    });
    expect(criteria.name).toBe('mozz');
    expect(criteria.acquisitionType).toBe('PURCHASED');
    expect(criteria.excludeAllergenIds).toHaveLength(1);
  });
  test('rejects invalid filter types', () => {
    expect(() => new ProductSearchCriteria({ isActive: 'yes' })).toThrow();
    expect(() => new ProductSearchCriteria({ name: 'x'.repeat(101) })).toThrow();
    expect(() => new ProductSearchCriteria({ categoryId: 'CAT-00001' })).toThrow();
    expect(() => new ProductSearchCriteria({ acquisitionType: 'OTHER' })).toThrow();
  });
});
