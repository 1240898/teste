import { AppError } from '../../../../shared/errors/AppError.js';

export const CATEGORY_NAME_MAX_LENGTH = 100;

/**
 * Non-empty descriptive name. Surrounding whitespace is trimmed and inner runs of
 * whitespace collapsed, so "  Soft   Drinks " and "Soft Drinks" are the same name.
 * Equality is case-insensitive, matching the uniqueness rule (BR1).
 */
export class CategoryName {
  #name;
  constructor(name) {
    if (typeof name !== 'string')
      throw new AppError('Category name must be text');
    const normalized = name.replace(/\s+/g, ' ').trim();
    if (!normalized) throw new AppError('Category name cannot be empty');
    if (normalized.length > CATEGORY_NAME_MAX_LENGTH)
      throw new AppError(
        `Category name must not exceed ${CATEGORY_NAME_MAX_LENGTH} characters`,
      );
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001F\u007F]/.test(normalized))
      throw new AppError('Category name contains invalid characters');
    this.#name = normalized;
    Object.freeze(this);
  }
  static create(name) {
    return new CategoryName(name);
  }
  getValue() {
    return this.#name;
  }
  equals(other) {
    return (
      other instanceof CategoryName &&
      this.#name.toLowerCase() === other.getValue().toLowerCase()
    );
  }
}
