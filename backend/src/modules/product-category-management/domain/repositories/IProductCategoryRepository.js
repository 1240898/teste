/**
 * Repository contract from the BCK03 class diagram.
 * `nextId` and the optional `findAll` filters are the only additions: the identifier
 * is allocated by the persistence layer (race-free) and BR4 requires searching.
 * `save` inserts new categories and persists changes to categories loaded by this adapter.
 * @typedef {Object} IProductCategoryRepository
 * @property {() => Promise<import('../model/CategoryId.js').CategoryId>} nextId
 * @property {(id: import('../model/CategoryId.js').CategoryId) => Promise<import('../model/ProductCategory.js').ProductCategory|null>} findById
 * @property {(name: import('../model/CategoryName.js').CategoryName) => Promise<import('../model/ProductCategory.js').ProductCategory|null>} findByName Case-insensitive exact match.
 * @property {(name: import('../model/CategoryName.js').CategoryName) => Promise<boolean>} existsByName
 * @property {(category: import('../model/ProductCategory.js').ProductCategory) => Promise<import('../model/ProductCategory.js').ProductCategory>} save
 * @property {(filters?: {name?: string, id?: string}) => Promise<import('../model/ProductCategory.js').ProductCategory[]>} findAll Case-insensitive "contains" search.
 * @property {(id: import('../model/CategoryId.js').CategoryId) => Promise<void>} delete
 * @property {(id: import('../model/CategoryId.js').CategoryId) => Promise<boolean>} isReferencedByProducts
 */
export {};
