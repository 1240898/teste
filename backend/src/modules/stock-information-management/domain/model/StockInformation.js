import { AppError } from '../../../../shared/errors/AppError.js';
import { AbstractStockQuantity, ProductId, StockId } from './values.js';

function validInstant(value, name) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()))
    throw new AppError(`${name} must be a valid date-time`);
  return new Date(value.getTime());
}

export class StockInformation {
  #id;
  #productId;
  #quantity;
  #startedAt;
  #endedAt;

  constructor(id, productId, quantity, startedAt, endedAt = null) {
    if (!(id instanceof StockId)) throw new AppError('StockId is required');
    if (!(productId instanceof ProductId))
      throw new AppError('ProductId is required');
    if (!(quantity instanceof AbstractStockQuantity))
      throw new AppError('Stock quantity is required');
    this.#startedAt = validInstant(startedAt, 'startedAt');
    this.#endedAt = endedAt === null ? null : validInstant(endedAt, 'endedAt');
    if (this.#endedAt && this.#endedAt < this.#startedAt)
      throw new AppError('endedAt cannot be earlier than startedAt');
    this.#id = id;
    this.#productId = productId;
    this.#quantity = quantity;
  }

  static startTracking(
    id,
    productId,
    initialUnits = 0,
    startedAt = new Date(),
  ) {
    return new StockInformation(
      id,
      productId,
      AbstractStockQuantity.create(initialUnits),
      startedAt,
    );
  }

  static create(id, productId, quantity, startedAt, endedAt = null) {
    return new StockInformation(id, productId, quantity, startedAt, endedAt);
  }

  increase(units) {
    this.#assertCurrent();
    this.#quantity = this.#quantity.increase(units);
  }

  decrease(units) {
    this.#assertCurrent();
    this.#quantity = this.#quantity.decrease(units);
  }

  endTracking(endedAt = new Date()) {
    this.#assertCurrent();
    const end = validInstant(endedAt, 'endedAt');
    if (end < this.#startedAt)
      throw new AppError('endedAt cannot be earlier than startedAt');
    this.#endedAt = end;
  }

  getId() {
    return this.#id;
  }

  getProductId() {
    return this.#productId;
  }

  getAvailableUnits() {
    return this.#quantity.getValue();
  }

  getStartedAt() {
    return new Date(this.#startedAt.getTime());
  }

  getEndedAt() {
    return this.#endedAt ? new Date(this.#endedAt.getTime()) : null;
  }

  isCurrent() {
    return this.#endedAt === null;
  }

  #assertCurrent() {
    if (!this.isCurrent())
      throw new AppError('Historical stock information cannot be changed', 409);
  }
}
