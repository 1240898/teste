/**
 * PostgreSQL allergens row (the diagram's persistence model, represented by pg rows).
 * @typedef {Object} AllergenPersistenceModel
 * @property {number} id EU Regulation No. 1169/2011 number, 1..14.
 * @property {string} name Display name; unique case-insensitively (lower(name) index).
 * @property {Date} created_at
 * @property {Date} updated_at
 */
export {};