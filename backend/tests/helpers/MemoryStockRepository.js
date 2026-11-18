import { AppError } from '../../src/shared/errors/AppError.js';

export class MemoryStockRepository {
  constructor() {
    this.stocks = new Map();
    this.history = new Map();
    this.sequence = 0;
  }

  async nextId() {
    let candidate;
    do {
      this.sequence += 1;
      candidate = `STOCK-${String(this.sequence).padStart(5, '0')}`;
    } while (
      [...this.stocks.values(), ...this.history.values()].some(
        (stock) => stock.getId().getValue() === candidate,
      )
    );
    return candidate;
  }

  async findCurrentByProductIdForUpdate(productId) {
    return this.stocks.get(productId.getValue()) ?? null;
  }

  async insert(stock) {
    const productId = stock.getProductId().getValue();
    if (this.stocks.has(productId))
      throw new AppError(
        'Stock information already exists for this Product',
        409,
      );
    this.stocks.set(productId, stock);
  }

  async save(stock) {
    const productId = stock.getProductId().getValue();
    const current = this.stocks.get(productId);
    if (!current || current.getId().getValue() !== stock.getId().getValue())
      throw new AppError('Stock information not found', 404);
    if (stock.isCurrent()) this.stocks.set(productId, stock);
    else {
      this.stocks.delete(productId);
      this.history.set(stock.getId().getValue(), stock);
    }
  }
}

export class MemoryStockQueryRepository {
  constructor(stockRepository, productDetails) {
    Object.assign(this, { stockRepository, productDetails });
  }

  toSummary(stock) {
    if (!stock) return null;
    const productId = stock.getProductId().getValue();
    return {
      stockId: stock.getId().getValue(),
      productId,
      productName: this.productDetails.get(productId)?.name,
      availableUnits: stock.getAvailableUnits(),
      startedAt: stock.getStartedAt(),
      endedAt: stock.getEndedAt(),
    };
  }

  async findCurrentSummaryByProductId(productId) {
    return this.toSummary(
      this.stockRepository.stocks.get(productId.getValue()) ?? null,
    );
  }

  async searchPeriods(criteria) {
    const summaries = [
      ...this.stockRepository.stocks.values(),
      ...this.stockRepository.history.values(),
    ]
      .filter((stock) => stock.isCurrent() === !criteria.historical)
      .map((stock) => this.toSummary(stock))
      .filter((summary) =>
        criteria.productId
          ? summary.productId === criteria.productId.getValue()
          : true,
      )
      .filter((summary) =>
        criteria.productName
          ? summary.productName
              .toLowerCase()
              .includes(criteria.productName.toLowerCase())
          : true,
      );
    const filtered = summaries.filter((summary) => {
      if (criteria.isActive === undefined) return true;
      return (
        this.productDetails.get(summary.productId)?.isActive ===
        criteria.isActive
      );
    });
    const offset = (criteria.page - 1) * criteria.pageSize;
    return {
      items: filtered.slice(offset, offset + criteria.pageSize),
      totalItems: filtered.length,
    };
  }
}

export class MemoryStockUnitOfWork {
  async withTransaction(work) {
    return work({ memoryTransaction: true });
  }
}
