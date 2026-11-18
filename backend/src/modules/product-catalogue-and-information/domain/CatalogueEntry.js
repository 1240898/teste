/** Read-only evaluated representation of one sellable Product. */
export class CatalogueEntry {
  constructor({
    product,
    available,
    category,
    price = null,
    allergens = [],
    components = [],
    sizes = [],
    isPizza = false,
  }) {
    Object.assign(this, {
      product,
      available,
      category,
      price,
      allergens: Object.freeze([...allergens]),
      components: Object.freeze([...components]),
      sizes: Object.freeze([...sizes]),
      isPizza,
    });
    Object.freeze(this);
  }
}
