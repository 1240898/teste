import { AppError } from '../../../../shared/errors/AppError.js';

export const PRODUCT_NAME_MAX_LENGTH = 100;

/**
 * Mandatory product name (BR2): trimmed, 1-100 characters, no control characters.
 * Names are NOT unique (client clarification): two products may share a name.
 */
export class ProductName {
  #name;
  constructor(name) {
    if (typeof name !== 'string')
      throw new AppError('Product name must be text');
    const normalized = name.trim();
    if (!normalized) throw new AppError('Product name cannot be empty');
    if (normalized.length > PRODUCT_NAME_MAX_LENGTH)
      throw new AppError(
        `Product name must not exceed ${PRODUCT_NAME_MAX_LENGTH} characters`,
      );
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001F\u007F]/.test(normalized))
      throw new AppError('Product name contains invalid characters');
    this.#name = normalized;
    Object.freeze(this);
  }
  static create(name) {
    return new ProductName(name);
  }
  getValue() {
    return this.#name;
  }
  equals(other) {
    return other instanceof ProductName && this.#name === other.getValue();
  }
}