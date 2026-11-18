import { AppError } from '../../../../shared/errors/AppError.js';

export class Quantity {
  #amount;

  constructor(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2_147_483_647)
      throw new AppError('Quantity must be a positive integer');
    this.#amount = amount;
    Object.freeze(this);
  }

  static create(amount) {
    return new Quantity(amount);
  }

  getAmount() {
    return this.#amount;
  }
}
