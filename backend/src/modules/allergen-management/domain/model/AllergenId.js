import { AppError } from '../../../../shared/errors/AppError.js';
import { MAX_ALLERGEN_ID, MIN_ALLERGEN_ID } from './EUAllergenType.js';

/**
 * Immutable identifier of an Allergen: an integer between 1 and 14 matching the
 * EU Regulation No. 1169/2011 list.
 */
export class AllergenId {
  #value;
  constructor(value) {
    const number =
      typeof value === 'string' && /^\d{1,2}$/.test(value)
        ? Number(value)
        : value;
    if (
      !Number.isInteger(number) ||
      number < MIN_ALLERGEN_ID ||
      number > MAX_ALLERGEN_ID
    )
      throw new AppError(
        `Allergen id must be an integer between ${MIN_ALLERGEN_ID} and ${MAX_ALLERGEN_ID}`,
      );
    this.#value = number;
    Object.freeze(this);
  }
  static create(id) {
    return new AllergenId(id);
  }
  getValue() {
    return this.#value;
  }
  equals(other) {
    return other instanceof AllergenId && this.#value === other.getValue();
  }
}