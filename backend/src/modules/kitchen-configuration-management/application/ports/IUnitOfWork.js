/**
 * Transaction boundary (same port as product-management, BCK05 / BCK09).
 * Implemented by shared/persistence/postgres/PostgresUnitOfWork.
 * @typedef {Object} IUnitOfWork
 * @property {<T>(work: (tx: object) => Promise<T>) => Promise<T>} withTransaction
 */
export {};