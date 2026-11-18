/**
 * Structural repository contract. Persistence operations return or persist the
 * complete StockInformation aggregate and use the caller's transaction.
 * @typedef {Object} IStockRepository
 * @property {(tx: object) => Promise<string>} nextId
 * @property {(productId: import('../model/values.js').ProductId, tx: object) => Promise<import('../model/StockInformation.js').StockInformation|null>} findCurrentByProductIdForUpdate
 * @property {(stock: import('../model/StockInformation.js').StockInformation, tx: object) => Promise<void>} save
 * @property {(stock: import('../model/StockInformation.js').StockInformation, tx: object) => Promise<void>} insert
 * Each aggregate is a single tracking period. Ending a period timestamps it;
 * the final quantity and the historical row are retained.
 */
export {};
