import { AppError } from '../../../../shared/errors/AppError.js';

const mandatoryTypeIds = new Set(['type-01', 'type-02', 'type-03', 'type-04']);

export class PostgresComponentTypeImpactGuard {
  async assertSafeCreate(_candidate, _tx) {
    // New bounds govern compositions created or edited after this point. They
    // must not invalidate already stored predefined pizza compositions.
  }

  async assertSafeUpdate(_current, _candidate, _tx) {
    // Updating bounds preserves existing compositions. BCK10 validates them
    // against the current rules only when a composition is created/replaced.
  }

  async assertSafeRemoval(current, _tx) {
    if (mandatoryTypeIds.has(current.getId().getValue()))
      throw new AppError(
        'The four mandatory component types cannot be removed',
        409,
      );
  }
}
