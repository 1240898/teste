/**
 * PostgreSQL users row (the diagram's persistence model, represented by pg rows).
 * @typedef {Object} UserPersistenceModel
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} password_hash Encoded bcrypt hash, never an API field.
 * @property {string[]} roles
 * @property {boolean} active
 * @property {boolean} marketing_consent_given
 * @property {Date} marketing_consent_timestamp
 * @property {Date} created_at
 * @property {Date} updated_at
 */
export {};
