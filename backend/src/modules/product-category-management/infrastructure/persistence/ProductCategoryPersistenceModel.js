/**
 * PostgreSQL product_categories row (the diagram's persistence model, represented by pg rows).
 * @typedef {Object} ProductCategoryPersistenceModel
 * @property {string} id Business identifier, e.g. "CAT-00123".
 * @property {string} name Display name; unique case-insensitively (lower(name) index).
 * @property {Date} created_at
 * @property {Date} updated_at
 */
export {};
