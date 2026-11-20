import { InvalidCatalogueData } from './InvalidCatalogueData.js';

const identifier = (value) =>
  typeof value?.getValue === 'function' ? value.getValue() : value;

const addUnique = (map, key, value, label) => {
  if (map.has(key))
    throw new InvalidCatalogueData(`Duplicate ${label}: ${key}`);
  map.set(key, value);
};

/** Immutable read snapshot assembled from the owning bounded contexts. */
export class CatalogueFacts {
  #roots;
  #products;
  #categories;
  #allergens;
  #pizzas;
  #configurations;
  #currentStock;
  #sizes;

  constructor({
    roots = [],
    products = [],
    categories = [],
    allergens = [],
    pizzas = [],
    configurations = [],
    stockRecords = [],
    sizes = [],
  } = {}) {
    if (
      ![
        roots,
        products,
        categories,
        allergens,
        pizzas,
        configurations,
        stockRecords,
        sizes,
      ].every(Array.isArray)
    )
      throw new InvalidCatalogueData('Catalogue facts must be collections');

    this.#roots = Object.freeze([...roots]);
    this.#products = new Map();
    for (const product of products)
      addUnique(
        this.#products,
        identifier(product.getId()),
        product,
        'Product',
      );

    this.#categories = new Map();
    for (const category of categories)
      addUnique(
        this.#categories,
        identifier(category.getId()),
        category,
        'Product Category',
      );

    this.#allergens = new Map();
    for (const allergen of allergens)
      addUnique(
        this.#allergens,
        identifier(allergen.getId()),
        allergen,
        'Allergen',
      );

    this.#pizzas = new Map();
    const predefinedProducts = products.filter(
      (product) => product.getPricingMode() === 'COMPONENT_BASED',
    );
    for (const pizza of predefinedProducts)
      this.#pizzas.set(identifier(pizza.getId()), pizza);
    for (const pizza of pizzas) {
      const key = identifier(pizza.getId?.() ?? pizza.getProductId?.());
      if (key) this.#pizzas.set(key, pizza);
    }

    this.#configurations = new Map();
    for (const configuration of configurations) {
      const key = this.#configurationKey(
        configuration.getProductId(),
        configuration.getSizeId(),
      );
      addUnique(
        this.#configurations,
        key,
        configuration,
        'component-size configuration',
      );
    }

    this.#currentStock = new Map();
    for (const stock of stockRecords) {
      if (!stock.isCurrent()) continue;
      addUnique(
        this.#currentStock,
        identifier(stock.getProductId()),
        stock,
        'current stock record',
      );
    }
    this.#sizes = Object.freeze([...sizes]);
    Object.freeze(this);
  }

  #configurationKey(productId, sizeId) {
    return `${identifier(productId)}::${identifier(sizeId)}`;
  }

  getRoots() {
    return [...this.#roots];
  }

  getPizza(productId) {
    return this.#pizzas.get(identifier(productId)) ?? null;
  }

    getProduct(productId) {
    return this.#products.get(identifier(productId)) ?? null;
  }

  resolveComponents(composition) {
    return composition.map((item) => {
      const productId = identifier(item.getProductId?.() ?? item);
      const component = this.#products.get(productId);
      if (!component)
        throw new InvalidCatalogueData(
          `Predefined pizza references missing Product ${productId}`,
        );
      return component;
    });
  }

  getCategory(categoryId) {
    return this.#categories.get(identifier(categoryId)) ?? null;
  }

  getAllergens(allergenIds) {
    return allergenIds.map(
      (allergenId) => this.#allergens.get(identifier(allergenId)) ?? null,
    );
  }

  getSizes() {
    return [...this.#sizes];
  }

  getConfiguration(productId, sizeId) {
    return (
      this.#configurations.get(this.#configurationKey(productId, sizeId)) ??
      null
    );
  }

  getCurrentStock(productId) {
    return this.#currentStock.get(identifier(productId)) ?? null;
  }
}
