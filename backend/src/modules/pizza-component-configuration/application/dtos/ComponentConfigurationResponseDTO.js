export class ComponentConfigurationResponseDTO {
  constructor({ productId, sizeId, amount, currency, stockUnitsConsumed }) {
    Object.assign(this, {
      productId,
      sizeId,
      amount,
      currency,
      stockUnitsConsumed,
    });
    Object.freeze(this);
  }
}
