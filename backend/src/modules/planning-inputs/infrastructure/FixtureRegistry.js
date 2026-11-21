import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InputError } from '../domain/InputError.js';

const directory = new URL('../../../../fixtures/planning/', import.meta.url);
const key = (id, version) => JSON.stringify([id, version]);

export class FixtureRegistry {
  constructor(datasets) {
    this.datasets = new Map();
    for (const data of datasets) {
      if (typeof data.id !== 'string' || !data.id || typeof data.version !== 'string' || !data.version)
        throw new TypeError('Each planning fixture needs an explicit string ID and version.');
      const identity = key(data.id, data.version);
      if (this.datasets.has(identity)) throw new TypeError('Duplicate planning fixture ID/version.');
      this.datasets.set(identity, structuredClone(data));
    }
  }

  static async fromDirectory(path) {
    const files = (await readdir(path)).filter((name) => name.endsWith('.json')).sort();
    return new FixtureRegistry(await Promise.all(files.map(async (name) =>
      JSON.parse(await readFile(join(path, name), 'utf8')))));
  }

  static async bundled() {
    const files = ['five-medium.json', 'personalized.json', 'iarti.json', 'daily-sales.json', 'chained-dough.json'];
    const datasets = await Promise.all(files.map(async (name) =>
      JSON.parse(await readFile(fileURLToPath(new URL(name, directory)), 'utf8'))));
    return new FixtureRegistry(datasets);
  }

  get(selector) {
    const data = this.datasets.get(key(selector?.id, selector?.version));
    if (!data) throw new InputError('SOURCE_NOT_FOUND', 'The selected fixture version does not exist.',
      404, 'source', selector?.id);
    // Each capture receives its own copy, never a mutable global source document.
    return structuredClone(data);
  }

  offers(selector, productIds) {
    const scenario = this.get(selector).supplierScenario;
    if (!scenario) throw new InputError('SOURCE_NOT_FOUND', 'Supplier scenario not found.', 404);
    if (scenario.id !== selector.id || scenario.version !== selector.version)
      throw new InputError('SOURCE_VERSION_MISMATCH', 'Supplier source identity/version differs from its fixture selection.', 422);
    if (scenario.status !== 'CONFIRMED')
      throw new InputError('SUPPLIER_VERSION_NOT_CONFIRMED', 'The selected version is not confirmed.', 409);
    if (!Array.isArray(scenario.supplierIds) || !Array.isArray(scenario.offers))
      throw new InputError('MISSING_FIELD', 'Supplier IDs and offers must be explicit arrays.', 422, 'supplierScenario');
    const offers = scenario.offers.filter((offer) => productIds.includes(offer.productId));
    const supplierIds = scenario.supplierIds.filter((id) => offers.some((offer) => offer.supplierId === id));
    return { id: selector.id, version: selector.version, status: 'CONFIRMED', supplierIds,
      offers, provenance: [{ dataset: 'offers', source: selector.id, version: selector.version, simulated: true }] };
  }
}
