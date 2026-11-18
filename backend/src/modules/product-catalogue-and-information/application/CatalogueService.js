import { CataloguePolicy } from '../domain/CataloguePolicy.js';
import { CatalogueNotFoundError } from './CatalogueNotFoundError.js';
import { CatalogueResponseMapper } from './CatalogueResponseMapper.js';

const normalizedName = (name) => name.trim().toLocaleLowerCase('en');

export class CatalogueService {
  constructor({
    reader,
    policy = new CataloguePolicy(),
    mapper = new CatalogueResponseMapper(),
  }) {
    if (!reader) throw new TypeError('ICatalogueReader is required');
    Object.assign(this, { reader, policy, mapper });
  }

  async list({ componentName } = {}) {
    const facts = await this.reader.loadSellable();
    const entries = facts
      .getRoots()
      .map((product) => this.policy.evaluate(product, facts))
      .filter(Boolean);
    const matchingEntries = componentName
      ? entries.filter((entry) => this.#matchesComponent(entry, componentName))
      : entries;
    return matchingEntries.map((entry) => this.mapper.toDTO(entry));
  }

  async getById(productId) {
    const facts = await this.reader.loadFor(productId);
    const product = facts
      .getRoots()
      .find((candidate) => candidate.getId().equals(productId));
    if (!product?.isSellable()) throw new CatalogueNotFoundError();

    const entry = this.policy.evaluate(product, facts);
    if (!entry) throw new CatalogueNotFoundError();
    return this.mapper.toDTO(entry);
  }

  #matchesComponent(entry, componentName) {
    const expected = normalizedName(componentName);
    const candidates = entry.isPizza
      ? entry.components
      : entry.product.isPizzaComponent()
        ? [entry.product]
        : [];
    return candidates.some(
      (component) =>
        normalizedName(component.getName().getValue()) === expected,
    );
  }
}
