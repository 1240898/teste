import { AppError } from '../../../../shared/errors/AppError.js';

export const ALLERGEN_NAME_MAX_LENGTH = 100;

/**
 * Non-empty descriptive name. Surrounding whitespace is trimmed and inner runs of
 * whitespace collapsed. Equality is case-insensitive, matching the uniqueness rule (BR1).
 */
export class AllergenName {
  #name;
  constructor(name) {
    if (typeof name !== 'string')
      throw new AppError('Allergen name must be text');
    const normalized = name.replace(/\s+/g, ' ').trim();
    if (!normalized) throw new AppError('Allergen name cannot be empty');
    if (normalized.length > ALLERGEN_NAME_MAX_LENGTH)
      throw new AppError(
        `Allergen name must not exceed ${ALLERGEN_NAME_MAX_LENGTH} characters`,
      );
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001F\u007F]/.test(normalized))
      throw new AppError('Allergen name contains invalid characters');
    this.#name = normalized;
    Object.freeze(this);
  }
  static create(name) {
    return new AllergenName(name);
  }
  getValue() {
    return this.#name;
  }
  equals(other) {
    return (
      other instanceof AllergenName &&
      this.#name.toLowerCase() === other.getValue().toLowerCase()
    );
  }
}