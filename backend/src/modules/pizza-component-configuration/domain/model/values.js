import { AppError } from '../../../../shared/errors/AppError.js';

class StringIdentifier {
  #value;

  constructor(value, label) {
    if (typeof value !== 'string' || !value.trim())
      throw new AppError(`Invalid ${label}`);
    this.#value = value;
    Object.freeze(this);
  }

  getValue() {
    return this.#value;
  }

  equals(other) {
    return (
      other instanceof this.constructor && this.#value === other.getValue()
    );
  }
}

export class ProductId extends StringIdentifier {
  constructor(value) {
    super(value, 'product ID');
  }

  static create(value) {
    return new ProductId(value);
  }
}

export class PizzaSizeId extends StringIdentifier {
  constructor(value) {
    super(value, 'pizza size ID');
  }

  static create(value) {
    return new PizzaSizeId(value);
  }
}

function canonicalizeAmount(amount) {
  if (typeof amount !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(amount))
    throw new AppError(
      'Price amount must be a non-negative decimal with at most two decimal places',
    );
  const [whole, decimals = ''] = amount.split('.');
  const canonicalWhole = whole.replace(/^0+(?=\d)/, '');
  return `${canonicalWhole}.${decimals.padEnd(2, '0')}`;
}

export class Money {
  #amount;
  #currency;

  constructor(amount, currency) {
    if (currency !== 'EUR') throw new AppError('Price currency must be EUR');
    this.#amount = canonicalizeAmount(amount);
    this.#currency = currency;
    Object.freeze(this);
  }

  static create(amount, currency) {
    return new Money(amount, currency);
  }

  getAmount() {
    return this.#amount;
  }

  getCurrency() {
    return this.#currency;
  }
}

export class StockUnitsConsumed {
  #units;

  constructor(units) {
    if (!Number.isInteger(units) || units < 0)
      throw new AppError('Stock units consumed must be a non-negative integer');
    this.#units = units;
    Object.freeze(this);
  }

  static create(units) {
    return new StockUnitsConsumed(units);
  }

  getUnits() {
    return this.#units;
  }
}
