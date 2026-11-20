const componentTypes = new Map([
  ['type-01', ['Base Dough', 'componentTypeBaseDough']],
  ['type-02', ['Base Sauce', 'componentTypeBaseSauce']],
  ['type-03', ['Cheese', 'componentTypeCheese']],
  ['type-04', ['Topping', 'componentTypeTopping']],
]);

const categories = new Map([
  ['beverages', 'categoryBeverages'],
  ['desserts', 'categoryDesserts'],
  ['starters', 'categoryStarters'],
  ['pizza ingredients', 'categoryPizzaIngredients'],
]);

export function componentTypeLabel(type, t) {
  const reference = componentTypes.get(type?.id);
  if (reference && type.name?.trim().toLocaleLowerCase('en') === reference[0].toLowerCase())
    return t(reference[1]);
  return type?.name ?? '';
}

export function categoryLabel(category, t) {
  const key = categories.get(category?.name?.trim().toLocaleLowerCase('en'));
  return key ? t(key) : (category?.name ?? '');
}
