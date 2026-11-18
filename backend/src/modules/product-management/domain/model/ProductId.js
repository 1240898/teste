import { AppError } from '../../../../shared/errors/AppError.js';

const PATTERN = /^PROD-\d{5,}$/;
const MAX_LENGTH = 32;

/** Immutable business identifier of a Product, e.g. "PROD-00123" (BR1). */
export class ProductId {
  #value;
  constructor(value) {
    const normalized =
      typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (normalized.length > MAX_LENGTH || !PATTERN.test(normalized))
      throw new AppError('Invalid product id');
    this.#value = normalized;
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