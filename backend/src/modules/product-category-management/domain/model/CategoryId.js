import { AppError } from '../../../../shared/errors/AppError.js';

const PATTERN = /^CAT-\d{5,}$/;

/** Immutable business identifier of a ProductCategory, e.g. "CAT-00123". */
export class CategoryId {
  #value;
  constructor(value) {
    if (typeof value !== 'string' || !PATTERN.test(value.toUpperCase()))
      throw new AppError('Invalid category id');
    this.#value = value.toUpperCase();
    Object.freeze(this);
  }
  static create(id) {
    return new CategoryId(id);
  }
  getValue() {
    return this.#value;
  }
  equals(other) {
    return other instanceof CategoryId && this.#value === other.getValue();
  }
}
