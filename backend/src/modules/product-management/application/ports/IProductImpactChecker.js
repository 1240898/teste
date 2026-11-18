/**
 * Cross-story guard (BR10 / BR10.1): rejects with AppError(409) any Product change
 * that would invalidate an existing BCK08 component-size configuration or BCK10
 * predefined pizza. Deactivation is never checked here (it preserves references).
 * @typedef {Object} IProductImpactChecker
 * @property {(id: import('../../domain/model/ProductId.js').ProductId, tx: object) => Promise<void>} assertComponentRoleRemovable
 * @property {(id: import('../../domain/model/ProductId.js').ProductId, newType: import('../../../pizza-component-type-management/domain/model/values.js').ComponentTypeId, tx: object) => Promise<void>} assertComponentTypeChangeAllowed
 * @property {(id: import('../../domain/model/ProductId.js').ProductId, newMode: string|null, tx: object) => Promise<void>} assertPricingModeChangeAllowed
 */
export {};
