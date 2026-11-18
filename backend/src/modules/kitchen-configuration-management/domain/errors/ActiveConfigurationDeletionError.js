import { AppError } from '../../../../shared/errors/AppError.js';

export const ACTIVE_DELETION_MESSAGE =
  'The active kitchen configuration cannot be deleted. Activate another configuration first.';

/** AC 6 / BR 10: the active configuration is never deleted (409). */
export class ActiveConfigurationDeletionError extends AppError {
  constructor() {
    super(ACTIVE_DELETION_MESSAGE, 409);
    this.name = 'ActiveConfigurationDeletionError';
  }
}