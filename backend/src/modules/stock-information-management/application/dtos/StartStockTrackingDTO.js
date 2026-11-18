export class StartStockTrackingDTO {
  constructor({ productId, initialUnits } = {}) {
    Object.assign(this, { productId, initialUnits });
    Object.freeze(this);
  }
}
