import { CataloguePolicy } from '../domain/CataloguePolicy.js';
import { CatalogueNotFoundError } from './CatalogueNotFoundError.js';
import { CatalogueResponseMapper } from './CatalogueResponseMapper.js';
import { InvalidCatalogueData } from '../domain/InvalidCatalogueData.js';

const normalizedName = (name) => name.trim().toLocaleLowerCase('en');
const idValue = (value) =>
  typeof value?.getValue === 'function' ? value.getValue() : value;

export class CatalogueService {
    constructor({
    reader,
    policy = new CataloguePolicy(),
    mapper = new CatalogueResponseMapper(),
    logger = console,
  }) {
    if (!reader) throw new TypeError('ICatalogueReader is required');
    Object.assign(this, { reader, policy, mapper, logger });
  }

  async list({ componentName, componentIds, excludeComponentIds, excludeAllergenIds } = {}) {
    const facts = await this.reader.loadSellable();
          // One product with inconsistent catalogue data is left out of the list
    // instead of failing the whole catalogue; managers see it as not offered.
    const entries = facts
      .getRoots()
      .map((product) => this.#evaluateOrSkip(product, facts))
      .filter(Boolean);
    const requiredComponents = this.#csv(componentIds);
    const excludedComponents = new Set(this.#csv(excludeComponentIds));
    const excludedAllergens = new Set(
      this.#csv(excludeAllergenIds).map(Number),
    );
    const matchingEntries = entries.filter((entry) => {
      if (componentName && !this.#matchesComponent(entry, componentName))
        return false;
      const components = this.#entryComponents(entry);
      const componentIdsInEntry = new Set(
        components.map((component) => idValue(component.getId())),
      );
      if (!requiredComponents.every((id) => componentIdsInEntry.has(id)))
        return false;
      if ([...excludedComponents].some((id) => componentIdsInEntry.has(id)))
        return false;
      const allergenIdsInEntry = new Set(
        entry.allergens.map((allergen) => Number(idValue(allergen.getId()))),
      );
      return ![...excludedAllergens].some((id) => allergenIdsInEntry.has(id));
    });
    return matchingEntries.map((entry) => this.mapper.toDTO(entry));
  }

  #csv(value) {
    if (!value) return [];
    return [...new Set(String(value).split(',').map((item) => item.trim()))];
  }

    #evaluateOrSkip(product, facts) {
    try {
      return this.policy.evaluate(product, facts);
    } catch (error) {
      if (!(error instanceof InvalidCatalogueData)) throw error;
      this.logger.warn(
        `Catalogue: product ${idValue(product.getId())} omitted - ${error.message}`,
      );
      return null;
    }
  }

  #entryComponents(entry) {
    return entry.isPizza
      ? entry.components
      : entry.product.isPizzaComponent()
        ? [entry.product]
        : [];
  }

  async getById(productId) {
    const facts = await this.reader.loadFor(productId);
    const product = facts
      .getRoots()
      .find((candidate) => candidate.getId().equals(productId));
    if (!product?.isSellable()) throw new CatalogueNotFoundError();

    const entry = this.#evaluateOrSkip(product, facts);
    if (!entry) throw new CatalogueNotFoundError();
    return this.mapper.toDTO(entry);
  }

  #matchesComponent(entry, componentName) {
    const expected = normalizedName(componentName);
    const candidates = this.#entryComponents(entry);
    return candidates.some(
      (component) =>
        normalizedName(component.getName().getValue()) === expected,
    );
  }
}
