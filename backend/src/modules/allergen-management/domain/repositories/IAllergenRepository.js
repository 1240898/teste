/**
 * Repository contract from the BCK04 class diagram.
 * The only addition is the optional `findAll` filters, required by BR4 (search).
 * `save` inserts new allergens and persists changes to allergens loaded by this adapter.
 * @typedef {Object} IAllergenRepository
 * @property {(id: import('../model/AllergenId.js').AllergenId) => Promise<import('../model/Allergen.js').Allergen|null>} findById
 * @property {(name: import('../model/AllergenName.js').AllergenName) => Promise<import('../model/Allergen.js').Allergen|null>} findByName Case-insensitive exact match.
 * @property {(name: import('../model/AllergenName.js').AllergenName) => Promise<boolean>} existsByName
 * @property {(allergen: import('../model/Allergen.js').Allergen) => Promise<import('../model/Allergen.js').Allergen>} save
 * @property {(filters?: {name?: string, id?: import('../model/AllergenId.js').AllergenId}) => Promise<import('../model/Allergen.js').Allergen[]>} findAll Name: case-insensitive "contains"; id: exact.
 * @property {(id: import('../model/AllergenId.js').AllergenId) => Promise<void>} delete
 * @property {(id: import('../model/AllergenId.js').AllergenId) => Promise<boolean>} isReferenced True when products or dietary restrictions use the allergen.
 */
export {};