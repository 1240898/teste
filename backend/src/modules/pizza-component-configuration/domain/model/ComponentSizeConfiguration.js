import { AppError } from '../../../../shared/errors/AppError.js';
import { StockUnitsConsumed } from './values.js';

function identifierOf(reference, label) {
  if (!reference || typeof reference.getId !== 'function')
    throw new AppError(`${label} reference is required`);
  const identifier = reference.getId();
  if (!identifier || typeof identifier.getValue !== 'function')
    throw new AppError(`${label} reference has an invalid ID`);
  return identifier;
}

function validateProduct(product) {
  if (!product || typeof product.isPizzaComponent !== 'function')
    throw new AppError('Product reference is required');
  if (!product.isPizzaComponent())
    throw new AppError('Product is not designated as a pizza component');
  if (typeof product.isStockControlled !== 'function')
    throw new AppError('Product stock-control information is required');
}

function validatePrice(price) {
  if (!price || typeof price.getAmount !== 'function')
    throw new AppError('Price is required');
}

function validateUnits(product, units) {
  if (product.isStockControlled()) {
    if (units === null || units === undefined)
      throw new AppError(
        'Stock units consumed are required for a stock-controlled product',
      );
    return StockUnitsConsumed.create(units);
  }
  if (units !== null)
    throw new AppError(
      'Stock units consumed must be null for a non-stock-controlled product',
    );
  return null;
}

export class ComponentSizeConfiguration {
  #productId;
  #sizeId;
  #price;
  #stockUnitsConsumed;

  constructor(product, size, price, units) {
    validateProduct(product);
    validatePrice(price);
    const productId = identifierOf(product, 'Product');
    const sizeId = identifierOf(size, 'Pizza Size');
    this.#productId = productId;
    this.#sizeId = sizeId;
    this.#price = price;
    this.#stockUnitsConsumed = validateUnits(product, units);
    Object.freeze(this);
  }

  static create(product, size, price, units) {
    return new ComponentSizeConfiguration(product, size, price, units);
  }

  revised(product, price, units) {
    validateProduct(product);
    const revisedProductId = identifierOf(product, 'Product');
    if (revisedProductId.getValue() !== this.#productId.getValue())
      throw new AppError('Product reference cannot change');
    validatePrice(price);
    return new ComponentSizeConfiguration(
      product,
      { getId: () => this.#sizeId },
      price,
      units,
    );
  }

  getProductId() {
    return this.#productId;
  }

  getSizeId() {
    return this.#sizeId;
  }

  getPrice() {
    return this.#price;
  }

  getStockUnitsConsumed() {
    return this.#stockUnitsConsumed;
  }

  getConsumption() {
    return this.#stockUnitsConsumed;
  }
}
