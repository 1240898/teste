export const componentTypeToPayload = (value) => ({
  name: value.name.trim(),
  assemblyOrder: Number(value.assemblyOrder),
  minQuantity: Number(value.minQuantity),
  maxQuantity: value.maxQuantity === '' ? null : Number(value.maxQuantity),
});
