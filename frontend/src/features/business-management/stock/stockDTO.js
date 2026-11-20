export const stockStartToPayload = (value) => ({
  productId: value.productId.trim(),
  initialUnits:
    value.initialUnits === '' ? undefined : Number(value.initialUnits),
});
export const stockAdjustmentToPayload = (value) => ({
  direction: value.direction,
  units: Number(value.units),
});
