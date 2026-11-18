import { AppError } from '../../../../shared/errors/AppError.js';
import { CategoryId } from '../../../product-category-management/domain/model/CategoryId.js';
import { AllergenId } from '../../../allergen-management/domain/model/AllergenId.js';
import { ComponentTypeId } from '../../../pizza-component-type-management/domain/model/values.js';
import { Money } from './Money.js';
import { PricingMode } from './PricingMode.js';
import { AcquisitionType } from './AcquisitionType.js';
import { ProductCompositionItem } from './ProductCompositionItem.js';
import { Quantity } from './Quantity.js';
import { ProductDescription } from './ProductDescription.js';
import { ProductId } from './ProductId.js';
import { ProductName } from './ProductName.js';

const isValidDate = (date) =>
  date instanceof Date && Number.isFinite(date.getTime());

/**
 * @typedef {Object} ProductProps Editable state of a Product (POST/PUT body as VOs).
 * @property {ProductName} name
 * @property {ProductDescription} description
 * @property {CategoryId} categoryId
 * @property {boolean} isSellable
 * @property {boolean} isPizzaComponent
 * @property {string} acquisitionType
 * @property {ProductCompositionItem[]} compositionItems
 * @property {ComponentTypeId|null} pizzaComponentTypeId
 * @property {AllergenId[]} allergenIds
 * @property {string|null} pricingMode One of PricingMode.FIXED / COMPONENT_BASED, or null.
 * @property {Money|null} basePrice
 */

/**
 * Aggregate root of the Product aggregate (BCK05). Protects every local invariant
 * (BR2-BR7). Category, component type and allergens are referenced by identity;
 * their existence and cross-story impact are checked by the application layer.
 * Stock quantities are NOT part of this aggregate (owned by BCK09).
 */
export class Product {
  #id;
  #props;
  #isActive;
  #createdAt;
  #updatedAt;

  constructor({ id, props, isActive, createdAt, updatedAt }) {
    if (!(id instanceof ProductId)) throw new AppError('Invalid product id');
    Product.validateProps(props);
    if (
      typeof isActive !== 'boolean' ||
      !isValidDate(createdAt) ||
      !isValidDate(updatedAt)
    )
      throw new AppError('Invalid product state');
    this.#id = id;
    this.#props = Product.#freeze(props);
    this.#isActive = isActive;
    this.#createdAt = createdAt.getTime();
    this.#updatedAt = updatedAt.getTime();
    Object.freeze(this);
  }

  /**
   * Validates the editable state against the domain invariants. Called by the
   * application service BEFORE any database access, so invalid input never opens
   * a transaction (400 Bad Request).
   * @param {ProductProps} props
   */
  static validateProps(props) {
    if (!props || typeof props !== 'object')
      throw new AppError('Invalid product data');
    const {
      name,
      description,
      categoryId,
      isSellable,
      isPizzaComponent,
      acquisitionType,
      compositionItems,
      pizzaComponentTypeId,
      allergenIds,
      pricingMode,
      basePrice,
    } = props;

    if (
      !(name instanceof ProductName) ||
      !(description instanceof ProductDescription) ||
      !(categoryId instanceof CategoryId)
    )
      throw new AppError('Invalid product data');
    if (
      ![isSellable, isPizzaComponent].every(
        (flag) => typeof flag === 'boolean',
      )
    )
      throw new AppError('Product characteristics must be true or false');

    // BR4 / Q6: at least one product type; stock control alone is not a type.
    if (!isSellable && !isPizzaComponent)
      throw new AppError(
        'A product must be sellable, a pizza component, or both',
      );

    AcquisitionType.from(acquisitionType);

    if (
      !Array.isArray(compositionItems) ||
      !compositionItems.every((item) => item instanceof ProductCompositionItem)
    )
      throw new AppError('Invalid product composition');
    const compositionTotals = new Map();
    for (const item of compositionItems) {
      const productId = item.getProductId().getValue();
      const total =
        (compositionTotals.get(productId) ?? 0) +
        item.getQuantity().getAmount();
      // The domain stores one composition item per product. Validate the
      // combined quantity as well as each incoming quantity before normalizing.
      Quantity.create(total);
      compositionTotals.set(productId, total);
    }

    // BR5: pizza component <=> exactly one pizza component type.
    if (
      pizzaComponentTypeId !== null &&
      !(pizzaComponentTypeId instanceof ComponentTypeId)
    )
      throw new AppError('Invalid pizza component type id');
    if (isPizzaComponent && pizzaComponentTypeId === null)
      throw new AppError('A pizza component requires a pizza component type');
    if (!isPizzaComponent && pizzaComponentTypeId !== null)
      throw new AppError(
        'Only pizza components can have a pizza component type',
      );

    // BR7: zero or more allergens, without duplicates.
    if (
      !Array.isArray(allergenIds) ||
      !allergenIds.every((id) => id instanceof AllergenId)
    )
      throw new AppError('Invalid allergen list');
    const distinct = new Set(allergenIds.map((id) => id.getValue()));
    if (distinct.size !== allergenIds.length)
      throw new AppError('Allergens must not be repeated');

    // BR6: commercial information.
    if (basePrice !== null && !(basePrice instanceof Money))
      throw new AppError('Invalid base price');
    if (pricingMode !== null && PricingMode.from(pricingMode) === null)
      throw new AppError('Invalid pricing mode');
    if (!isSellable) {
      if (pricingMode !== null || basePrice !== null)
        throw new AppError(
          'Non-sellable products must not have a pricing mode or a selling price',
        );
      return;
    }
    if (pricingMode === null)
      throw new AppError('Sellable products require a pricing mode');
    if (pricingMode === PricingMode.FIXED && basePrice === null)
      throw new AppError('Fixed-price sellable products require a base price');
    if (pricingMode === PricingMode.COMPONENT_BASED) {
      if (basePrice !== null)
        throw new AppError(
          'Component-based products must not have a base price',
        );
      // Client clarification: a predefined pizza's product is Sellable and NOT a component.
      if (isPizzaComponent)
        throw new AppError(
          'A pizza component cannot have a component-based price',
        );
    }
  }

  /** Creates a new, active product; the id is allocated by the repository (BR1). */
  static create(id, props) {
    const now = new Date();
    const state = {
      id,
      props,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    return Product.#createSubtype(state);
  }

  /** Rebuilds a persisted product from primitives, re-validating every invariant. */
  static restore(state) {
    const compositionItems = (state.compositionItems ?? []).map((item) =>
      item instanceof ProductCompositionItem
        ? item
        : ProductCompositionItem.create(
            item.productId ?? item.product_id,
            item.quantity,
          ),
    );
    const restored = {
      id: ProductId.create(state.id),
      props: {
        name: ProductName.create(state.name),
        description: ProductDescription.create(state.description),
        categoryId: CategoryId.create(state.categoryId),
        isSellable: state.isSellable,
        isPizzaComponent: state.isPizzaComponent,
        acquisitionType: state.acquisitionType,
        compositionItems,
        pizzaComponentTypeId:
          state.pizzaComponentTypeId === null ||
          state.pizzaComponentTypeId === undefined
            ? null
            : ComponentTypeId.create(state.pizzaComponentTypeId),
        allergenIds: (state.allergenIds ?? []).map((id) =>
          AllergenId.create(id),
        ),
        pricingMode: PricingMode.from(state.pricingMode),
        basePrice:
          state.basePrice === null || state.basePrice === undefined
            ? null
            : Money.create(state.basePrice, state.basePriceCurrency),
      },
      isActive: state.isActive,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
    return Product.#createSubtype(restored);
  }

  /**
   * Materializes the domain subtype from the Product's classifications. The
   * classifications overlap, so products that are both sellable and components
   * use a dedicated concrete subtype instead of forcing exclusive inheritance.
   */
  static #createSubtype(state) {
    const { isSellable, isPizzaComponent, pricingMode } = state.props;
    if (isSellable && isPizzaComponent)
      return new SellablePizzaComponent(state);
    if (isPizzaComponent) return new PizzaComponent(state);
    if (pricingMode === PricingMode.COMPONENT_BASED)
      return new PredefinedPizza(state);
    if (isSellable) return new SellableProduct(state);
    return new Product(state);
  }

  static #freeze(props) {
    const compositionTotals = new Map();
    for (const item of props.compositionItems) {
      const productId = item.getProductId().getValue();
      compositionTotals.set(
        productId,
        (compositionTotals.get(productId) ?? 0) +
          item.getQuantity().getAmount(),
      );
    }
    return Object.freeze({
      ...props,
      compositionItems: Object.freeze(
        [...compositionTotals].map(([productId, quantity]) =>
          ProductCompositionItem.create(productId, quantity),
        ),
      ),
      allergenIds: Object.freeze(
        [...props.allergenIds].sort((a, b) => a.getValue() - b.getValue()),
      ),
    });
  }

  /** Replaces the editable state (PUT full-replacement semantics). */
  revise(props) {
    Product.validateProps(props);
    if (
      this instanceof PredefinedPizza &&
      (!props.isSellable ||
        props.isPizzaComponent ||
        props.pricingMode !== PricingMode.COMPONENT_BASED)
    )
      throw new AppError(
        'A Predefined Pizza must remain a component-based Sellable Product',
      );
    this.#props = Product.#freeze(props);
    this.#touch();
  }

  replaceComposition(items) {
    if (
      !Array.isArray(items) ||
      !items.every((item) => item instanceof ProductCompositionItem)
    )
      throw new AppError('Invalid product composition');
    const ids = items.map((item) => item.getProductId().getValue());
    if (new Set(ids).size !== ids.length)
      throw new AppError('A Product composition cannot repeat a child Product');
    this.revise({ ...this.#props, compositionItems: items });
  }

  /** Soft deactivation (BR9). Idempotent; stock and references are untouched (D6). */
  deactivate() {
    if (!this.#isActive) return;
    this.#isActive = false;
    this.#touch();
  }

  /** Reactivation. Idempotent. */
  activate() {
    if (this.#isActive) return;
    this.#isActive = true;
    this.#touch();
  }

  #touch() {
    // Keep updatedAt strictly monotonic even within the same millisecond.
    this.#updatedAt = Math.max(Date.now(), this.#updatedAt + 1);
  }

  getId() {
    return this.#id;
  }
  getName() {
    return this.#props.name;
  }
  getDescription() {
    return this.#props.description;
  }
  getCategoryId() {
    return this.#props.categoryId;
  }
  isSellable() {
    return this.#props.isSellable;
  }
  isPizzaComponent() {
    return this.#props.isPizzaComponent;
  }
  getAcquisitionType() {
    return this.#props.acquisitionType;
  }
  getCompositionItems() {
    return [...this.#props.compositionItems];
  }
  isActive() {
    return this.#isActive;
  }
  getPizzaComponentTypeId() {
    return this.#props.pizzaComponentTypeId;
  }
  getAllergenIds() {
    return [...this.#props.allergenIds];
  }
  getPricingMode() {
    return this.#props.pricingMode;
  }
  getBasePrice() {
    return this.#props.basePrice;
  }
  get createdAt() {
    return new Date(this.#createdAt);
  }
  get updatedAt() {
    return new Date(this.#updatedAt);
  }
}

export class SellableProduct extends Product {}

export class PizzaComponent extends Product {
  static [Symbol.hasInstance](instance) {
    return (
      instance instanceof Product &&
      typeof instance.isPizzaComponent === 'function' &&
      instance.isPizzaComponent()
    );
  }
}

export class SellablePizzaComponent extends SellableProduct {}

export class PredefinedPizza extends SellableProduct {}
