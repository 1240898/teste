const keys = new Map(
  Array.from({ length: 14 }, (_, index) => [index + 1, `allergenName${index + 1}`]),
);

/** Use the localized EU allergen label, falling back to the API name. */
export function allergenLabel(id, apiName, t) {
  const key = keys.get(Number(id));
  return key ? t(key) : (apiName ?? String(id));
}
