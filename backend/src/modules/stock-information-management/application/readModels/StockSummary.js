import { ProductId, StockId } from '../../domain/model/values.js';

export class StockSummary {
  constructor({
    stockId,
    productId,
    productName,
    availableUnits,
    startedAt,
    endedAt,
  }) {
    Object.assign(this, {
      stockId: stockId instanceof StockId ? stockId : StockId.create(stockId),
      productId:
        productId instanceof ProductId
          ? productId
          : ProductId.create(productId),
      productName,
      availableUnits,
      startedAt,
      endedAt,
    });
    Object.freeze(this);
  }
}
