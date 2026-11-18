export class StockResponseDTO {
  constructor({
    stockId,
    productId,
    productName,
    availableUnits,
    startedAt,
    endedAt,
  }) {
    Object.assign(this, {
      stockId,
      productId,
      productName,
      availableUnits,
      startedAt,
      endedAt,
    });
    Object.freeze(this);
  }
}
