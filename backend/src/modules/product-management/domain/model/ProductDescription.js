import { AppError } from '../../../../shared/errors/AppError.js';

export const PRODUCT_DESCRIPTION_MAX_LENGTH = 500;

/** Mandatory product description (BR2): trimmed, 1-500 characters. */
export class ProductDescription {
  #text;
  constructor(text) {
    if (typeof text !== 'string')
      throw new AppError('Product description must be text');
    const normalized = text.trim();
    if (!normalized) throw new AppError('Product description cannot be empty');
    if (normalized.length > PRODUCT_DESCRIPTION_MAX_LENGTH)
      throw new AppError(
        `Product description must not exceed ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters`,
      );
    // Line breaks and tabs are allowed in a description; other control characters are not.
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized))
      throw new AppError('Product description contains invalid characters');
    this.#text = normalized;
    Object.freeze(this);
  }
  static create(text) {
    return new ProductDescription(text);
  }
  getValue() {
    return this.#text;
  }
  equals(other) {
    return (
      other instanceof ProductDescription && this.#text === other.getValue()
    );
  }
}