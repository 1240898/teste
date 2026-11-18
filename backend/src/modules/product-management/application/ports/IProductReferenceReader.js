/**
 * Checks that the aggregates a Product references (BCK03 / BCK07 / BCK04) exist.
 * Implemented in the infrastructure layer; `tx` keeps the check inside the same
 * transaction as the write.
 * @typedef {Object} IProductReferenceReader
 * @property {(id: import('../../../product-category-management/domain/model/CategoryId.js').CategoryId, tx?: object) => Promise<boolean>} categoryExists
 * @property {(id: import('../../../pizza-component-type-management/domain/model/values.js').ComponentTypeId, tx?: object) => Promise<boolean>} componentTypeExists
 * @property {(ids: import('../../../allergen-management/domain/model/AllergenId.js').AllergenId[], tx?: object) => Promise<import('../../domain/model/AllergenId.js').AllergenId[]>} findMissingAllergens Returns the ids that do not exist (empty when all exist).
 * @property {(ids: import('../../domain/model/ProductId.js').ProductId[], tx?: object) => Promise<string[]>} findMissingCompositionProducts
 * @property {(ids: import('../../domain/model/ProductId.js').ProductId[], tx?: object) => Promise<string[]>} findUnclassifiedCompositionProducts
 * @property {(parentId: import('../../domain/model/ProductId.js').ProductId, childIds: import('../../domain/model/ProductId.js').ProductId[], tx?: object) => Promise<boolean>} compositionWouldCreateCycle
 */
export {};
