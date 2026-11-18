import { AppError } from '../../../../shared/errors/AppError.js';

export const PIZZA_SIZE_ID_PATTERN = '^PSIZE-[0-9]{4,}$';
const PIZZA_SIZE_ID_REGEX = new RegExp(PIZZA_SIZE_ID_PATTERN, 'i');

const invalid = (message) => {
  throw new AppError(message, 400);
};

export class PizzaSizeId {
  constructor(value) {
    if (typeof value !== 'string' || !PIZZA_SIZE_ID_REGEX.test(value))
      invalid('Invalid pizza size id');
    this.value = value.toUpperCase();
    Object.freeze(this);
  }
  static create(value) {
    return new PizzaSizeId(value);
  }
  getValue() {
    return this.value;
  }
}

export class PizzaSizeName {
  constructor(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 50)
      invalid('Name must contain 1 to 50 characters');
    this.value = value.trim();
    Object.freeze(this);
  }
  static create(value) {
    return new PizzaSizeName(value);
  }
  getValue() {
    return this.value;
  }
}

export class PizzaSizeSearchCriteria {
  constructor(criteria = {}) {
    this.criteria = Object.fromEntries(
      Object.entries(criteria)
        .filter(
          ([key, value]) =>
            (key === 'active' && typeof value === 'boolean') ||
            (typeof value === 'string' && value.trim()),
        )
        .map(([key, value]) => [
          key,
          typeof value === 'string' ? value.trim() : value,
        ]),
    );
    Object.freeze(this.criteria);
    Object.freeze(this);
  }
  static create(criteria) {
    return new PizzaSizeSearchCriteria(criteria);
  }
  getValue() {
    return { ...this.criteria };
  }
}
