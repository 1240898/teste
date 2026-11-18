/**
 * Repository contract of the Product aggregate (BCK05 class diagram).
 * `tx` is the transaction context handed out by IUnitOfWork.withTransaction; when it
 * is omitted the adapter uses its own connection.
 * `save` inserts new products and updates products previously loaded by the adapter,
 * replacing the product's allergen links.
 * @typedef {Object} IProductRepository
 * @property {(tx?: object) => Promise<import('../model/ProductId.js').ProductId>} nextId
 * @property {(id: import('../model/ProductId.js').ProductId, tx?: object) => Promise<import('../model/Product.js').Product|null>} findById
 * @property {(id: import('../model/ProductId.js').ProductId, tx: object) => Promise<import('../model/Product.js').Product|null>} findByIdForUpdate Locks the product row (SELECT ... FOR UPDATE).
 * @property {() => Promise<import('../model/Product.js').Product[]>} listPredefinedPizzas Lists Products that have a predefined default composition (BCK10 query contract).
 * @property {(criteria: import('../search/ProductSearchCriteria.js').ProductSearchCriteria) => Promise<import('../model/Product.js').Product[]>} search
 * @property {(product: import('../model/Product.js').Product, tx?: object) => Promise<import('../model/Product.js').Product>} save
 */
export {};
