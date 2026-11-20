export const componentConfigurationToPayload = (value, editing) => ({
  ...(editing
    ? {}
    : { productId: value.productId.trim(), sizeId: value.sizeId.trim() }),
  amount: String(value.amount).trim(),
  currency: value.currency.trim(),
  stockUnitsConsumed:
    value.stockUnitsConsumed === '' ? null : Number(value.stockUnitsConsumed),
});
export const componentConfigurationToForm = (item) => ({
  productId: item.productId ?? '',
  sizeId: item.sizeId ?? '',
  amount: item.amount ?? '',
  currency: item.currency ?? 'EUR',
  stockUnitsConsumed: item.stockUnitsConsumed ?? '',
});
