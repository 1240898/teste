import { Allergen } from '../../src/modules/allergen-management/domain/model/Allergen.js';
import { AllergenId } from '../../src/modules/allergen-management/domain/model/AllergenId.js';
import { AllergenName } from '../../src/modules/allergen-management/domain/model/AllergenName.js';
import { CategoryId } from '../../src/modules/product-category-management/domain/model/CategoryId.js';
import { CategoryName } from '../../src/modules/product-category-management/domain/model/CategoryName.js';
import { ProductCategory } from '../../src/modules/product-category-management/domain/model/ProductCategory.js';
import { ComponentSizeConfiguration } from '../../src/modules/pizza-component-configuration/domain/model/ComponentSizeConfiguration.js';
import {
  Money as ComponentMoney,
  StockUnitsConsumed,
} from '../../src/modules/pizza-component-configuration/domain/model/values.js';
import { PizzaSize } from '../../src/modules/pizza-size-management/domain/model/PizzaSize.js';
import {
  PizzaSizeId,
  PizzaSizeName,
} from '../../src/modules/pizza-size-management/domain/model/values.js';
import { ProductCompositionItem } from '../../src/modules/product-management/domain/model/ProductCompositionItem.js';
import { Product } from '../../src/modules/product-management/domain/model/Product.js';
import { AcquisitionType } from '../../src/modules/product-management/domain/model/AcquisitionType.js';
import { Money as ProductMoney } from '../../src/modules/product-management/domain/model/Money.js';
import { PricingMode } from '../../src/modules/product-management/domain/model/PricingMode.js';
import { ProductDescription } from '../../src/modules/product-management/domain/model/ProductDescription.js';
import { ProductId } from '../../src/modules/product-management/domain/model/ProductId.js';
import { ProductName } from '../../src/modules/product-management/domain/model/ProductName.js';
import { ComponentTypeId } from '../../src/modules/pizza-component-type-management/domain/model/values.js';
import { StockInformation } from '../../src/modules/stock-information-management/domain/model/StockInformation.js';
import {
  AbstractStockQuantity,
  ProductId as StockProductId,
  StockId,
} from '../../src/modules/stock-information-management/domain/model/values.js';
import { CatalogueFacts } from '../../src/modules/product-catalogue-and-information/domain/CatalogueFacts.js';

const fixedDate = new Date('2026-01-01T00:00:00.000Z');

export function product({
  id = 'PROD-00001',
  name = 'Product',
  sellable = true,
  component = false,
  active = true,
  componentTypeId = component ? 'type-01' : null,
  allergenIds = [],
  pricingMode = sellable ? PricingMode.FIXED : null,
  price = sellable && pricingMode === PricingMode.FIXED ? 4.25 : null,
  categoryId = 'CAT-00001',
} = {}) {
  return Product.restore({
    id,
    name,
    description: `${name} description`,
    categoryId,
    isSellable: sellable,
    isPizzaComponent: component,
    acquisitionType: AcquisitionType.PRODUCED,
    isActive: active,
    pizzaComponentTypeId: componentTypeId === null ? null : componentTypeId,
    allergenIds,
    pricingMode,
    basePrice: price,
    basePriceCurrency: price === null ? undefined : 'EUR',
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
}

export function category({ id = 'CAT-00001', name = 'Pizza' } = {}) {
  return ProductCategory.restore({
    id,
    name,
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
}

export function allergen({ id = 1, name = 'Gluten' } = {}) {
  return Allergen.restore({
    id,
    name,
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
}

export function size({
  id = 'PSIZE-0001',
  name = 'Small',
  active = true,
} = {}) {
  return PizzaSize.restore({
    id: PizzaSizeId.create(id),
    name: PizzaSizeName.create(name),
    isActive: active,
  });
}

export function componentConfiguration({
  component: componentProduct,
  size: pizzaSize,
  price = '2.00',
  consumed = null,
}) {
  return ComponentSizeConfiguration.create(
    {
      getId: () => componentProduct.getId(),
      isPizzaComponent: () => componentProduct.isPizzaComponent(),
      isStockControlled: () => consumed !== null,
    },
    pizzaSize,
    ComponentMoney.create(String(price), 'EUR'),
    consumed === null ? null : StockUnitsConsumed.create(consumed).getUnits(),
  );
}

export function stock({
  productId = 'PROD-00001',
  units = 1,
  endedAt = null,
  id = 'STOCK-00001',
}) {
  return StockInformation.create(
    StockId.create(id),
    StockProductId.create(productId),
    AbstractStockQuantity.create(units),
    fixedDate,
    endedAt,
  );
}

export function predefinedPizza({ productId = 'PROD-00001', componentIds }) {
  const pizza = product({
    id: productId,
    name: 'Predefined Pizza',
    pricingMode: PricingMode.COMPONENT_BASED,
    price: null,
  });
  pizza.replaceComposition(
    componentIds.map((id) =>
      ProductCompositionItem.create(ProductId.create(id), 1),
    ),
  );
  return pizza;
}

export function facts({
  roots = [],
  products = roots,
  categories = [],
  allergens = [],
  pizzas = [],
  configurations = [],
  stockRecords = [],
  sizes = [],
} = {}) {
  return new CatalogueFacts({
    roots,
    products,
    categories,
    allergens,
    pizzas,
    configurations,
    stockRecords,
    sizes,
  });
}

export function productMoney(amount) {
  return ProductMoney.create(amount, 'EUR');
}

export const identifiers = Object.freeze({
  category: CategoryId,
  categoryName: CategoryName,
  allergen: AllergenId,
  allergenName: AllergenName,
  product: ProductId,
  productName: ProductName,
  productDescription: ProductDescription,
  componentType: ComponentTypeId,
});
