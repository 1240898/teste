/**
 * Structural application contracts for BCK08 integrations.
 * @typedef {Object} IUnitOfWork
 * @property {<T>(work: (tx: object) => Promise<T>) => Promise<T>} withTransaction
 * @typedef {Object} IComponentConfigurationImpactGuard
 * @property {(current: object|null, candidate: object, tx: object) => Promise<void>} assertSafeChange
 */
export {};
