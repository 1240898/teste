const parseIds = (ids) =>
  (typeof ids === 'string' ? JSON.parse(ids || '[]') : ids).map((id) =>
    String(id).trim(),
  );
export const predefinedPizzaToPayload = (value) => ({
  productId: value.productId.trim(),
  componentIds: parseIds(value.componentIds),
});
export const predefinedPizzaToForm = (pizza) => ({
  productId: pizza.id ?? pizza.productId ?? '',
  componentIds: (pizza.componentIds ?? []).map(String),
});
export const componentsToPayload = (value) => ({
  componentIds: parseIds(value.componentIds),
});
