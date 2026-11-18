/**
 * PostgreSQL rows of the Product aggregate (migration 0008_products.sql).
 *
 * @typedef {Object} ProductPersistenceModel `products` row.
 * @property {string} id Business identifier, e.g. "PROD-00123".
 * @property {string} name
 * @property {string} description
 * @property {string} category_id FK -> product_categories(id) ON DELETE RESTRICT.
 * @property {boolean} is_sellable
 * @property {boolean} is_pizza_component
 * @property {'PRODUCED'|'PURCHASED'} acquisition_type
 * @property {boolean} is_active
 * @property {string|null} pizza_component_type_id FK -> pizza_component_types(id).
 * @property {string|null} pricing_mode 'FIXED' | 'COMPONENT_BASED' | null.
 * @property {string|number|null} base_price_amount NUMERIC(10,2) (pg returns a string).
 * @property {string|null} base_price_currency 'EUR' | null.
 * @property {Date} created_at
 * @property {Date} updated_at
 * @property {number[]} allergen_ids Aggregated from product_allergens.
 * @property {{productId: string, quantity: number}[]} composition_items
 *
 * @typedef {Object} ProductAllergenPersistenceModel `product_allergens` row.
 * @property {string} product_id
 * @property {number} allergen_id SMALLINT FK -> allergens(id) ON DELETE RESTRICT.
 */
export {};
