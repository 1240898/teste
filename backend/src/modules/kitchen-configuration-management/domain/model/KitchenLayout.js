import { MAP_PROPERTIES } from './KitchenLayoutFormat.js';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Asset ids referenced by a (possibly invalid) document: model.assetId and every
 * *MapAssetId of the floor, the walls and the elements. Only strings are
 * collected, so this is safe to run before validation (SD 1).
 */
export function collectAssetReferences(raw) {
  const ids = new Set();
  const isObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const addMaterial = (material) => {
    if (!isObject(material)) return;
    for (const property of MAP_PROPERTIES)
      if (typeof material[property] === 'string') ids.add(material[property]);
  };
  if (!isObject(raw)) return [];
  addMaterial(raw.kitchen?.floor?.material);
  addMaterial(raw.kitchen?.walls?.material);
  if (Array.isArray(raw.elements))
    for (const element of raw.elements.slice(0, 1000)) {
      if (!isObject(element)) continue;
      if (typeof element.model?.assetId === 'string')
        ids.add(element.model.assetId);
      addMaterial(element.material);
    }
  return [...ids].slice(0, 1000);
}

/**
 * Validated kitchen layout (schemaVersion 1). Immutable: an edit replaces the
 * layout as a whole. Created only by KitchenLayoutValidator (new content) or
 * restored from PostgreSQL (content that was valid when it was stored).
 * Dimensions, assembly line and scene elements (placement, model reference,
 * material properties) are exposed as frozen parts of the document.
 */
export class KitchenLayout {
  #document;

  constructor(document) {
    this.#document = deepFreeze(structuredClone(document));
    Object.freeze(this);
  }

  /** Content that passed KitchenLayoutValidator. */
  static fromValidated(document) {
    return new KitchenLayout(document);
  }

  /** Content read back from the database (validated when it was written). */
  static restore(document) {
    return new KitchenLayout(document);
  }

  get schemaVersion() {
    return this.#document.schemaVersion;
  }
  get dimensions() {
    return this.#document.kitchen.dimensions;
  }
  get assemblyLine() {
    return this.#document.assemblyLine;
  }
  get elements() {
    return this.#document.elements;
  }
  get elementCount() {
    return this.#document.elements.length;
  }
  referencedAssetIds() {
    return collectAssetReferences(this.#document);
  }
  /** Deep copy of the stored document (never the frozen original). */
  toJSON() {
    return structuredClone(this.#document);
  }
}