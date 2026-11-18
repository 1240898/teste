import { AppError } from '../../../src/shared/errors/AppError.js';
import {
  Product,
  PredefinedPizza,
} from '../../../src/modules/product-management/domain/model/Product.js';
import { ProductId } from '../../../src/modules/product-management/domain/model/ProductId.js';
import { AcquisitionType } from '../../../src/modules/product-management/domain/model/AcquisitionType.js';
import { ProductCompositionItem } from '../../../src/modules/product-management/domain/model/ProductCompositionItem.js';

const state = (overrides = {}) => ({
  id: 'PROD-00123',
  name: 'Pizza',
  description: 'Pizza description',
  categoryId: 'CAT-00001',
  isSellable: true,
  isPizzaComponent: false,
  acquisitionType: AcquisitionType.PRODUCED,
  isActive: true,
  pizzaComponentTypeId: null,
  allergenIds: [],
  pricingMode: 'COMPONENT_BASED',
  basePrice: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('BCK10 Product subtype and default composition', () => {
  test('restores a PredefinedPizza subtype sharing the ProductId', () => {
    const pizza = Product.restore(state());
    expect(pizza).toBeInstanceOf(PredefinedPizza);
    expect(pizza.getId()).toEqual(ProductId.create('PROD-00123'));
    expect(pizza.getCompositionItems()).toEqual([]);
  });

  test('rejects a component-based Product that is not sellable or is a Pizza Component', () => {
    expect(() =>
      Product.restore(state({ isSellable: false, pricingMode: null })),
    ).toThrow(AppError);
    expect(() =>
      Product.restore(
        state({ isPizzaComponent: true, pizzaComponentTypeId: 'type-01' }),
      ),
    ).toThrow(AppError);
  });

  test('stores each default component once as a ProductCompositionItem with positive quantity', () => {
    const pizza = Product.restore(state());
    const dough = ProductCompositionItem.create(
      ProductId.create('PROD-00124'),
      1,
    );
    pizza.replaceComposition([dough]);
    expect(pizza.getCompositionItems()).toEqual([dough]);
    expect(() =>
      ProductCompositionItem.create(ProductId.create('PROD-00124'), 0),
    ).toThrow(AppError);
    expect(() => pizza.replaceComposition([dough, dough])).toThrow(AppError);
  });
});
