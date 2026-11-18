import { AppError } from '../../../../shared/errors/AppError.js';

export const StockAdjustmentDirection = Object.freeze({
  INCREASE: 'INCREASE',
  DECREASE: 'DECREASE',
});

export class StockAdjustmentDTO {
  constructor({ direction, units } = {}) {
    if (!Object.values(StockAdjustmentDirection).includes(direction))
      throw new AppError('Invalid stock adjustment direction');
    if (!Number.isSafeInteger(units) || units <= 0)
      throw new AppError('Adjustment units must be a positive integer');
    this.direction = direction;
    this.units = units;
    Object.freeze(this);
  }
}
