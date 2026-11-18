/**
 * Structural repository contract. Implementations return PizzaComponentType aggregates.
 * @typedef {Object} IComponentTypeRepository
 * @property {(tx: object) => Promise<string>} nextId
 * @property {(id: import('../model/values.js').ComponentTypeId, tx?: object) => Promise<import('../model/PizzaComponentType.js').PizzaComponentType|null>} findById
 * @property {(criteria: import('../model/ComponentTypeSearchCriteria.js').ComponentTypeSearchCriteria) => Promise<import('../model/PizzaComponentType.js').PizzaComponentType[]>} search
 * @property {(id: import('../model/values.js').ComponentTypeId, tx: object) => Promise<import('../model/PizzaComponentType.js').PizzaComponentType|null>} findByIdForUpdate
 * @property {(order: number, excludingId: import('../model/values.js').ComponentTypeId|null, tx: object) => Promise<boolean>} existsByOrder
 * @property {(type: import('../model/PizzaComponentType.js').PizzaComponentType, tx: object) => Promise<void>} insert
 * @property {(type: import('../model/PizzaComponentType.js').PizzaComponentType, tx: object) => Promise<void>} save
 * @property {(id: import('../model/values.js').ComponentTypeId, tx: object) => Promise<void>} delete
 */
export {};
