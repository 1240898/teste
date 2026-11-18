import { AppError } from '../../../../shared/errors/AppError.js';

export const INVALID_CONTENT_MESSAGE =
  'The kitchen configuration content is invalid';

/** AC 4 / BR 5: every issue of the content, answered as 422 with details. */
export class KitchenConfigurationValidationError extends AppError {
  constructor(issues) {
    super(INVALID_CONTENT_MESSAGE, 422, issues);
    this.name = 'KitchenConfigurationValidationError';
  }
}