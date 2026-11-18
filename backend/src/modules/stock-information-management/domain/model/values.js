import { AppError } from '../../../../shared/errors/AppError.js';

export const MAX_STOCK_UNITS = 2_147_483_647;

export class StockId {
  #value;

  constructor(value) {
    if (typeof value !== 'string' || !/^STOCK-\d{5,}$/.test(value.trim()))
      throw new AppError('Invalid StockId');
    this.#value = value.trim();
    Object.freeze(this);
  }

  static create(value) {
    return new StockId(value);
  }

  getValue() {
    return this.#value;
  }

  equals(other) {
    return other instanceof StockId && this.#value === other.getValue();
  }
}

export class ProductId {
  #value;

  constructor(value) {
    if (
      typeof value !== 'string' ||
      value.trim().length > 32 ||
      !/^PROD-\d{5,}$/.test(value.trim())
    )
      throw new AppError('Invalid ProductId');
    this.#value = value.trim();
    Object.freeze(this);
  }

  static create(value) {
    return new ProductId(value);
  }

  getValue() {
    return this.#value;
  }

  equals(other) {
    return other instanceof ProductId && this.#value === other.getValue();
  }
}

export class AbstractStockQuantity {
  #availableUnits;

  constructor(availableUnits) {
    if (
      !Number.isSafeInteger(availableUnits) ||
      availableUnits < 0 ||
      availableUnits > MAX_STOCK_UNITS
    )
      throw new AppError('Stock quantity must be a non-negative integer');
    this.#availableUnits = availableUnits;
    Object.freeze(this);
  }

  static create(availableUnits) {
    return new AbstractStockQuantity(availableUnits);
  }

  increase(units) {
    this.#assertPositiveInteger(units);
    const result = this.#availableUnits + units;
    if (result > MAX_STOCK_UNITS)
      throw new AppError('Stock quantity exceeds the supported limit', 409);
    return new AbstractStockQuantity(result);
  }

  decrease(units) {
    this.#assertPositiveInteger(units);
    if (units > this.#availableUnits)
      throw new AppError('Insufficient stock for the requested decrease', 409);
    return new AbstractStockQuantity(this.#availableUnits - units);
  }

  getValue() {
    return this.#availableUnits;
  }

  #assertPositiveInteger(units) {
    if (!Number.isSafeInteger(units) || units <= 0)
      throw new AppError('Adjustment units must be a positive integer');
  }
}
