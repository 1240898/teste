const parseList = (value) => {
  const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(parsed)) throw new TypeError('Expected a JSON array');
  return parsed;
};
export function productToForm(product = {}) {
  return {
    name: product.name ?? '',
    description: product.description ?? '',
    categoryId: product.categoryId ?? '',
    isSellable: Boolean(product.isSellable),
    isPizzaComponent: Boolean(product.isPizzaComponent),
    acquisitionType: product.acquisitionType ?? 'PURCHASED',
    compositionItems: (product.compositionItems ?? []).map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    pizzaComponentTypeId: product.pizzaComponentTypeId ?? '',
    allergenIds: (product.allergenIds ?? []).map(String),
    pricingMode: product.pricingMode ?? '',
    basePrice: product.basePrice ?? '',
    expectedUpdatedAt: product.updatedAt ?? '',
  };
}
export function productToPayload(value, editing = false) {
  const payload = {
    name: value.name.trim(),
    description: value.description.trim(),
    categoryId: value.categoryId.trim(),
    isSellable: value.isSellable === true || value.isSellable === 'true',
    isPizzaComponent:
      value.isPizzaComponent === true || value.isPizzaComponent === 'true',
    acquisitionType: value.acquisitionType,
    compositionItems: parseList(value.compositionItems).map(
      ({ productId, quantity }) => ({
        productId: String(productId).trim(),
        quantity: Number(quantity),
      }),
    ),
    pizzaComponentTypeId: value.pizzaComponentTypeId || null,
    allergenIds: parseList(value.allergenIds).map(Number),
    pricingMode: value.pricingMode || null,
    basePrice: value.basePrice === '' ? null : Number(value.basePrice),
  };
  if (editing) payload.expectedUpdatedAt = value.expectedUpdatedAt;
  return payload;
}
