export class CreatePredefinedPizzaDTO {
  constructor({ productId, componentIds }) {
    this.productId = productId;
    this.componentIds = componentIds;
    Object.freeze(this);
  }
}
