const valueOf = (value) =>
  typeof value?.getValue === 'function' ? value.getValue() : value;

const moneyDTO = (money) => ({
  amount: money.getAmount().toFixed(2),
  currency: money.getCurrency(),
});

export class CatalogueResponseMapper {
  toDTO(entry) {
    return {
      id: entry.product.getId().getValue(),
      name: entry.product.getName().getValue(),
      description: entry.product.getDescription().getValue(),
      available: entry.available,
      category: {
        id: entry.category.getId().getValue(),
        name: entry.category.getName().getValue(),
      },
      price: entry.isPizza ? null : moneyDTO(entry.price),
      allergens: entry.allergens.map((allergen) => ({
        id: allergen.getId().getValue(),
        name: allergen.getName().getValue(),
      })),
      pizza: entry.isPizza
        ? {
            defaultComponents: entry.components.map((component) => ({
              id: component.getId().getValue(),
              name: component.getName().getValue(),
              pizzaComponentTypeId: valueOf(
                component.getPizzaComponentTypeId(),
              ),
            })),
            sizes: entry.sizes.map((offer) => ({
              sizeId: valueOf(offer.sizeId),
              sizeName: offer.sizeName,
              price: moneyDTO(offer.price),
              available: offer.available,
            })),
          }
        : null,
    };
  }
}
