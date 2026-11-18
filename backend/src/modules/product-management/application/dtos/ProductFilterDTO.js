/**
 * Raw search filters of GET /api/v1/products. Values arrive as query strings
 * (booleans as "true"/"false", excludeAllergenIds as "1,7"); the service converts
 * them into a validated ProductSearchCriteria.
 */
export class ProductFilterDTO {
  constructor({
    name,
    categoryId,
    isSellable,
    isPizzaComponent,
    isActive,
    acquisitionType,
    pizzaComponentTypeId,
    excludeAllergenIds,
  } = {}) {
    Object.assign(this, {
      name,
      categoryId,
      isSellable,
      isPizzaComponent,
      isActive,
      acquisitionType,
      pizzaComponentTypeId,
      excludeAllergenIds,
    });
  }
}
