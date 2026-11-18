import { AppError } from '../../../../shared/errors/AppError.js';

export const AcquisitionType = Object.freeze({
  PRODUCED: 'PRODUCED',
  PURCHASED: 'PURCHASED',
  from(value) {
    if (value === this.PRODUCED || value === this.PURCHASED) return value;
    throw new AppError('Invalid acquisition type');
  },
});
