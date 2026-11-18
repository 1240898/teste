/**
 * Transaction boundary (D5). The same `tx` is passed to every repository/adapter
 * call of a use case, including BCK09's IStockProvisioning, so that the Product and
 * its stock record commit or roll back together.
 * Implemented by shared/persistence/postgres/PostgresUnitOfWork.
 * @typedef {Object} IUnitOfWork
 * @property {<T>(work: (tx: object) => Promise<T>) => Promise<T>} withTransaction
 */
export {};