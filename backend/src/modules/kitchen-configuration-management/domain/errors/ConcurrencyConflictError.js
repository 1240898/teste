import { AppError } from '../../../../shared/errors/AppError.js';

export const STALE_VERSION_MESSAGE =
  'This kitchen configuration was changed by another user. Reload it before saving.';

/** BR 12 / client clarification 15: optimistic concurrency (409). */
export class ConcurrencyConflictError extends AppError {
  constructor() {
    super(STALE_VERSION_MESSAGE, 409);
    this.name = 'ConcurrencyConflictError';
  }
}