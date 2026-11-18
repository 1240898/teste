/** Structural contracts represented by JavaScript objects at runtime. */

/**
 * @typedef {Object} IStockUseCases
 * @property {(request: import('../dtos/StartStockTrackingDTO.js').StartStockTrackingDTO) => Promise<import('../dtos/StockResponseDTO.js').StockResponseDTO>} startTracking
 * @property {(productId: import('../../domain/model/values.js').ProductId) => Promise<import('../dtos/StockResponseDTO.js').StockResponseDTO>} getForProduct
 * @property {(query: import('../dtos/StockSearchDTO.js').StockSearchDTO) => Promise<import('../dtos/StockSearchResultDTO.js').StockSearchResultDTO>} search
 * @property {(productId: import('../../domain/model/values.js').ProductId, request: import('../dtos/StockAdjustmentDTO.js').StockAdjustmentDTO) => Promise<import('../dtos/StockAdjustmentResultDTO.js').StockAdjustmentResultDTO>} adjustStock
 * @property {(productId: import('../../domain/model/values.js').ProductId) => Promise<void>} stopTracking
 */

/**
 * Internal contract used by order confirmation. The caller provides the
 * transaction so order confirmation and stock consumption commit together.
 * Returns true when units were consumed, false for an uncontrolled Product;
 * rejects for a missing or inactive Product, or insufficient stock. The
 * ordering flow invokes this for stock-controlled Products and separately
 * enforces the inactive-Product rule for uncontrolled Products.
 * @typedef {Object} IStockOrderConsumption
 * @property {(productId: string, units: number, tx: object) => Promise<boolean>} consumeForOrder
 */

/**
 * @typedef {Object} IStockQueryRepository
 * @property {(productId: import('../../domain/model/values.js').ProductId) => Promise<object|null>} findCurrentSummaryByProductId
 * @property {(criteria: import('../queries/StockSearchCriteria.js').StockSearchCriteria) => Promise<{items: object[], totalItems: number}>} searchPeriods
 */

/**
 * @typedef {Object} IProductReader
 * @property {(productId: import('../../domain/model/values.js').ProductId, tx: object) => Promise<{productId: import('../../domain/model/values.js').ProductId, productName: string, isActive: boolean}|null>} getByIdForUpdate
 */

/**
 * @typedef {Object} IUnitOfWork
 * @property {<T>(work: (tx: object) => Promise<T>) => Promise<T>} withTransaction
 */

export {};
