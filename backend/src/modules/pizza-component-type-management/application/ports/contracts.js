/**
 * Structural application contracts implemented by transaction and impact adapters.
 * @typedef {Object} IUnitOfWork
 * @property {<T>(work: (tx: object) => Promise<T>) => Promise<T>} withTransaction
 * @typedef {Object} IComponentTypeImpactGuard
 * @property {(candidate: import('../../domain/model/PizzaComponentType.js').PizzaComponentType, tx: object) => Promise<void>} assertSafeCreate
 * @property {(current: import('../../domain/model/PizzaComponentType.js').PizzaComponentType, candidate: import('../../domain/model/PizzaComponentType.js').PizzaComponentType, tx: object) => Promise<void>} assertSafeUpdate
 * @property {(current: import('../../domain/model/PizzaComponentType.js').PizzaComponentType, tx: object) => Promise<void>} assertSafeRemoval
 */
export {};
