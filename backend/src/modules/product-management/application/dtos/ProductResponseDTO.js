/**
 * Explicit allowlist of the product data exposed by the REST API.
 * Stock quantities are never part of it (consulted through BCK09).
 */
export class ProductResponseDTO {
  constructor({
    id,
    name,
    description,
    categoryId,
    isSellable,
    isPizzaComponent,
    acquisitionType,
    compositionItems,
    isActive,
    pizzaComponentTypeId,
    allergenIds,
    pricingMode,
    basePrice,
    createdAt,
    updatedAt,
  }) {
    Object.assign(this, {
      id,
      name,
      description,
      categoryId,
      isSellable,
      isPizzaComponent,
      acquisitionType,
      compositionItems,
      isActive,
      pizzaComponentTypeId,
      allergenIds,
      pricingMode,
      basePrice,
      createdAt,
      updatedAt,
    });
  }
}
