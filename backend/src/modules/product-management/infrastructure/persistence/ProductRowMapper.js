import { Product } from '../../domain/model/Product.js';

/** SQL row mapping only. HTTP response mapping lives in the application layer. */
export class ProductRowMapper {
  /** @param {import('./ProductPersistenceModel.js').ProductPersistenceModel} row */
  static toDomain(row) {
    const compositionItems = (row.composition_items ?? []).map((item) => ({
      productId: item.productId ?? item.product_id,
      quantity: Number(item.quantity),
    }));
    return Product.restore({
      id: row.id,
      name: row.name,
      description: row.description,
      categoryId: row.category_id,
      isSellable: row.is_sellable,
      isPizzaComponent: row.is_pizza_component,
      acquisitionType: row.acquisition_type,
      compositionItems,
      isActive: row.is_active,
      pizzaComponentTypeId: row.pizza_component_type_id,
      allergenIds: (row.allergen_ids ?? []).map(Number),
      pricingMode: row.pricing_mode,
      basePrice:
        row.base_price_amount === null || row.base_price_amount === undefined
          ? null
          : Number(row.base_price_amount),
      basePriceCurrency: row.base_price_currency ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  /** @returns {import('./ProductPersistenceModel.js').ProductPersistenceModel} */
  static toPersistence(product) {
    const price = product.getBasePrice();
    return {
      id: product.getId().getValue(),
      name: product.getName().getValue(),
      description: product.getDescription().getValue(),
      category_id: product.getCategoryId().getValue(),
      is_sellable: product.isSellable(),
      is_pizza_component: product.isPizzaComponent(),
      acquisition_type: product.getAcquisitionType(),
      is_active: product.isActive(),
      pizza_component_type_id:
        product.getPizzaComponentTypeId()?.getValue() ?? null,
      pricing_mode: product.getPricingMode(),
      base_price_amount: price ? price.getAmount().toFixed(2) : null,
      base_price_currency: price ? price.getCurrency() : null,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
      allergen_ids: product.getAllergenIds().map((id) => id.getValue()),
      composition_items: product.getCompositionItems().map((item) => ({
        product_id: item.getProductId().getValue(),
        quantity: item.getQuantity().getAmount(),
      })),
    };
  }
}
