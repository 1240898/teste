import { Money } from '../../product-management/domain/model/Money.js';
import { CatalogueEntry } from './CatalogueEntry.js';
import { InvalidCatalogueData } from './InvalidCatalogueData.js';
import { PizzaSizeOffer } from './PizzaSizeOffer.js';

const idValue = (value) =>
  typeof value?.getValue === 'function' ? value.getValue() : value;
const active = (entity) =>
  typeof entity?.isActive === 'function'
    ? entity.isActive()
    : entity?.isActive === true;
const sizeName = (size) => {
  const name =
    typeof size?.getName === 'function' ? size.getName() : size?.name;
  return typeof name?.getValue === 'function' ? name.getValue() : name;
};

export class CataloguePolicy {
  evaluate(product, facts) {
    if (!product.isSellable()) return null;

    const category = facts.getCategory(product.getCategoryId());
    if (!category)
      throw new InvalidCatalogueData(
        `Product ${product.getId().getValue()} references a missing category`,
      );

    const pizza = facts.getPizza(product.getId());
    const basePrice = product.getBasePrice();
    if (pizza && basePrice)
      throw new InvalidCatalogueData(
        `Product ${product.getId().getValue()} has both a fixed price and a PredefinedPizza`,
      );
    if (pizza) {
      if (pizza.getCompositionItems().length === 0)
        throw new InvalidCatalogueData(
          `Predefined pizza ${pizza.getId().getValue()} has no default composition`,
        );
      return this.#evaluatePizza(product, pizza, category, facts);
    }
    if (!basePrice)
      throw new InvalidCatalogueData(
        `Sellable Product ${product.getId().getValue()} has neither a fixed price nor a PredefinedPizza`,
      );

    return this.#evaluateFixedProduct(product, category, facts);
  }

  #evaluateFixedProduct(product, category, facts) {
    const price = product.getBasePrice();
    if (!price)
      throw new InvalidCatalogueData(
        `Fixed-price Product ${product.getId().getValue()} has no base price`,
      );
    const allergens = this.#resolveAllergens(product.getAllergenIds(), facts);
    const stockAvailable = this.#availableStock(product, facts, 1);
    return new CatalogueEntry({
      product,
      available: product.isActive() && stockAvailable,
      category,
      price,
      allergens,
    });
  }

  #evaluatePizza(product, pizza, category, facts) {
    const components = facts.resolveComponents(pizza.getCompositionItems());
    if (components.some((component) => !component.isPizzaComponent()))
      throw new InvalidCatalogueData(
        `Predefined pizza ${pizza.getId().getValue()} contains a non-component Product`,
      );

    const allergenIds = new Map();
    for (const component of components)
      for (const allergenId of component.getAllergenIds())
        allergenIds.set(idValue(allergenId), allergenId);
    const allergens = this.#resolveAllergens([...allergenIds.values()], facts);
    const sizes = facts
      .getSizes()
      .map((size) => this.#evaluateSize(components, size, product, facts))
      .filter(Boolean);

    return new CatalogueEntry({
      product,
      available: product.isActive() && sizes.some((offer) => offer.available),
      category,
      allergens,
      components,
      sizes,
      isPizza: true,
    });
  }

  #evaluateSize(components, size, pizza, facts) {
    const configurations = components.map((component) =>
      facts.getConfiguration(component.getId(), size.getId()),
    );
    if (configurations.some((configuration) => configuration === null))
      return null;

    const prices = configurations.map((configuration) =>
      this.#normalizeComponentPrice(configuration.getPrice()),
    );
    let price;
    try {
      price = Money.sum(prices);
    } catch {
      throw new InvalidCatalogueData('Pizza price cannot be represented');
    }
    let available = pizza.isActive() && active(size);

    for (let i = 0; i < components.length; i += 1) {
      const component = components[i];
      if (!component.isActive()) available = false;
      if (facts.getCurrentStock(component.getId())) {
        const consumed = configurations[i].getStockUnitsConsumed();
        if (!consumed)
          throw new InvalidCatalogueData(
            `Stock-controlled component ${component.getId().getValue()} has no configured consumption`,
          );
        if (!this.#availableStock(component, facts, consumed.getUnits()))
          available = false;
      }
    }

    return new PizzaSizeOffer({
      sizeId: size.getId(),
      sizeName: sizeName(size),
      price,
      available,
    });
  }

  #availableStock(product, facts, requiredUnits) {
    const stock = facts.getCurrentStock(product.getId());
    if (!stock) return true;
    return stock.getAvailableUnits() >= requiredUnits;
  }

  #normalizeComponentPrice(componentPrice) {
    const amount = componentPrice?.getAmount?.();
    const currency = componentPrice?.getCurrency?.();
    const numericAmount = Number(amount);
    if (
      typeof amount !== 'string' ||
      !Number.isFinite(numericAmount) ||
      currency !== 'EUR'
    )
      throw new InvalidCatalogueData('Component price is invalid');
    try {
      return Money.create(numericAmount, currency);
    } catch {
      throw new InvalidCatalogueData('Component price cannot be represented');
    }
  }

  #resolveAllergens(allergenIds, facts) {
    const allergens = facts.getAllergens(allergenIds);
    if (allergens.some((allergen) => allergen === null))
      throw new InvalidCatalogueData('Product references a missing allergen');
    return allergens;
  }
}
