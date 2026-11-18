import { AppError } from '../../../../shared/errors/AppError.js';

export const SUPPORTED_CURRENCY = 'EUR';
// Upper bound of NUMERIC(10,2), in cents.
const MAX_CENTS = 9_999_999_999;

/**
 * Monetary amount (BR6): EUR only, >= 0 (zero is allowed), at most 2 decimal places.
 * Stored internally as integer cents to avoid floating point drift.
 */
export class Money {
  #cents;
  #currency;
  constructor(amount, currency = SUPPORTED_CURRENCY) {
    if (typeof amount !== 'number' || !Number.isFinite(amount))
      throw new AppError('Price must be a number');
    if (amount < 0) throw new AppError('Price cannot be negative');
    const cents = Math.round(amount * 100);
    if (Math.abs(amount * 100 - cents) > 1e-6)
      throw new AppError('Price must have at most 2 decimal places');
    if (cents > MAX_CENTS) throw new AppError('Price is too large');
    if (currency !== SUPPORTED_CURRENCY)
      throw new AppError(`Only ${SUPPORTED_CURRENCY} prices are supported`);
    this.#cents = cents;
    this.#currency = currency;
    Object.freeze(this);
  }
  static create(amount, currency = SUPPORTED_CURRENCY) {
    return new Money(amount, currency);
  }

  /** Adds BCK05 Money values using their integer-cent representation. */
  static sum(values) {
    if (
      !Array.isArray(values) ||
      values.some((value) => !(value instanceof Money))
    )
      throw new AppError('Money values are required');
    const currency = values[0]?.#currency ?? SUPPORTED_CURRENCY;
    if (values.some((value) => value.#currency !== currency))
      throw new AppError('Money currencies must match');
    const cents = values.reduce((total, value) => total + value.#cents, 0);
    return new Money(cents / 100, currency);
  }

  getAmount() {
    return this.#cents / 100;
  }
  getCurrency() {
    return this.#currency;
  }
  equals(other) {
    return (
      other instanceof Money &&
      this.getAmount() === other.getAmount() &&
      this.#currency === other.getCurrency()
    );
  }
}
