/**
 * Repository contract of the KitchenConfiguration aggregate (WEB06 class diagram).
 * `tx` is the transaction context handed out by IUnitOfWork.withTransaction;
 * when it is omitted the adapter uses its own connection.
 *
 * @typedef {Object} KitchenConfigurationSummary
 * @property {string} id
 * @property {string} name
 * @property {'ACTIVE'|'INACTIVE'} status
 * @property {number} version
 * @property {number} elementCount
 * @property {Date} updatedAt
 * @property {Date|null} activatedAt
 *
 * @typedef {Object} IKitchenConfigurationRepository
 * @property {(tx: object) => Promise<import('../model/KitchenConfigurationId.js').KitchenConfigurationId>} nextId
 * @property {() => Promise<KitchenConfigurationSummary[]>} findAllSummaries Without the content (D11).
 * @property {(id, tx?) => Promise<import('../model/KitchenConfiguration.js').KitchenConfiguration|null>} findById
 * @property {(id, tx) => Promise<import('../model/KitchenConfiguration.js').KitchenConfiguration|null>} findByIdForUpdate SELECT ... FOR UPDATE.
 * @property {(tx?) => Promise<import('../model/KitchenConfiguration.js').KitchenConfiguration|null>} findActive
 * @property {(name: import('../model/ConfigurationName.js').ConfigurationName, excludeId?, tx?) => Promise<boolean>} existsByName
 * @property {(configuration, tx) => Promise<void>} insert Row + asset links.
 * @property {(configuration, expectedVersion: number, tx) => Promise<boolean>} replace Conditional UPDATE (status untouched) + asset links; false = stale version.
 * @property {(tx) => Promise<void>} lockActivation pg_advisory_xact_lock.
 * @property {(exceptId, tx) => Promise<import('../model/KitchenConfigurationId.js').KitchenConfigurationId|null>} deactivateCurrent
 * @property {(configuration, tx) => Promise<boolean>} markActive
 * @property {(id) => Promise<boolean>} deleteIfInactive DELETE ... WHERE status = 'INACTIVE'.
 */
export {};