export class StockAdjustmentResultDTO {
  constructor({
    stockId,
    productId,
    productName,
    direction,
    adjustedUnits,
    availableUnits,
  }) {
    Object.assign(this, {
      stockId,
      productId,
      productName,
      direction,
      adjustedUnits,
      availableUnits,
    });
    Object.freeze(this);
  }
}
