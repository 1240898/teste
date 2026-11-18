/** Input of POST /api/v1/products (shape already validated by the API schema). */
export class CreateProductDTO {
  constructor({
    name,
    description,
    categoryId,
    isSellable,
    isPizzaComponent,
    acquisitionType,
    compositionItems = [],
    pizzaComponentTypeId = null,
    allergenIds = [],
    pricingMode = null,
    basePrice = null,
  } = {}) {
    Object.assign(this, {
      name,
      description,
      categoryId,
      isSellable,
      isPizzaComponent,
      acquisitionType,
      compositionItems,
      pizzaComponentTypeId,
      allergenIds,
      pricingMode,
      basePrice,
    });
  }
}
