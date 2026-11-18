import { AppError } from '../../../../shared/errors/AppError.js';
import { PricingMode } from '../../domain/model/PricingMode.js';

export const COMPONENT_REFERENCED_MESSAGE =
  'Product is used as a pizza component by existing configurations or predefined pizzas';
export const PREDEFINED_PIZZA_REFERENCED_MESSAGE =
  'Product is used by an existing predefined pizza; its pricing cannot change';
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Tables owned by other modules that reference products (trusted, reviewed
 * constants; never request input). A table that does not exist yet (its story is
 * not merged) cannot hold references.
 * - component: references to a product used AS A PIZZA COMPONENT (BCK08, BCK10).
 * - predefinedPizza: references to a product that IS a predefined pizza (BCK10).
 * BCK10 must add its tables here when its migration is introduced.
 */
export const DEFAULT_PRODUCT_REFERENCES = Object.freeze({
  component: Object.freeze([
    Object.freeze({
      table: 'component_size_configurations',
      column: 'product_id',
    }),
    Object.freeze({
      table: 'product_composition_items',
      column: 'child_product_id',
    }),
  ]),
  predefinedPizza: Object.freeze([
    Object.freeze({
      table: 'product_composition_items',
      column: 'parent_product_id',
    }),
  ]),
});

/**
 * PostgreSQL adapter of IProductImpactChecker (BR10.1). Runs inside the update's
 * transaction, after the product row was locked.
 */
export class ProductImpactChecker {
  constructor(database, references = DEFAULT_PRODUCT_REFERENCES) {
    for (const { table, column } of [
      ...references.component,
      ...references.predefinedPizza,
    ])
      if (!IDENTIFIER.test(table) || !IDENTIFIER.test(column))
        throw new TypeError(`Invalid reference definition: ${table}.${column}`);
    this.database = database;
    this.references = references;
  }

  async assertComponentRoleRemovable(id, tx) {
    if (await this.#isReferenced(this.references.component, id, tx))
      throw new AppError(COMPONENT_REFERENCED_MESSAGE, 409);
  }

  async assertComponentTypeChangeAllowed(id, _newType, tx) {
    // Configurations/pizzas were validated against the current type: changing it
    // could break their min/max-per-type rules, so it is rejected while referenced.
    if (await this.#isReferenced(this.references.component, id, tx))
      throw new AppError(COMPONENT_REFERENCED_MESSAGE, 409);
  }

  async assertPricingModeChangeAllowed(id, newMode, tx) {
    if (newMode === PricingMode.COMPONENT_BASED) return;
    if (await this.#isReferenced(this.references.predefinedPizza, id, tx))
      throw new AppError(PREDEFINED_PIZZA_REFERENCED_MESSAGE, 409);
  }

  async #isReferenced(sources, id, tx) {
    const client = tx ?? this.database;
    for (const { table, column } of sources) {
      const { rows: present } = await client.query(
        'SELECT to_regclass($1) IS NOT NULL AS present',
        [table],
      );
      if (!present[0].present) continue;
      // Identifiers come from the validated constant list above.
      const { rows } = await client.query(
        `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${column} = $1) AS referenced`,
        [id.getValue()],
      );
      if (rows[0].referenced) return true;
    }
    return false;
  }
}
