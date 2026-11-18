import { AllergenId } from '../../../allergen-management/domain/model/AllergenId.js';

/**
 * PostgreSQL adapter of IProductReferenceReader. Reads the BCK03 / BCK07 / BCK04
 * tables by identity only (no other module's domain is imported). The foreign keys
 * of migration 0008 remain the final defence against concurrent removals.
 */
export class ProductReferenceReader {
  constructor(database) {
    this.database = database;
  }

  async categoryExists(id, tx) {
    const { rows } = await (tx ?? this.database).query(
      'SELECT EXISTS(SELECT 1 FROM product_categories WHERE id = $1) AS exists',
      [id.getValue()],
    );
    return rows[0].exists;
  }

  async componentTypeExists(id, tx) {
    const { rows } = await (tx ?? this.database).query(
      'SELECT EXISTS(SELECT 1 FROM pizza_component_types WHERE id = $1) AS exists',
      [id.getValue()],
    );
    return rows[0].exists;
  }

  async findMissingAllergens(ids, tx) {
    if (!ids.length) return [];
    const { rows } = await (tx ?? this.database).query(
      'SELECT id FROM allergens WHERE id = ANY($1::smallint[])',
      [ids.map((id) => id.getValue())],
    );
    const existing = new Set(rows.map((row) => Number(row.id)));
    return ids
      .filter((id) => !existing.has(id.getValue()))
      .map((id) => AllergenId.create(id.getValue()));
  }

  async findMissingCompositionProducts(ids, tx) {
    if (!ids.length) return [];
    const values = ids.map((id) => id.getValue());
    const { rows } = await (tx ?? this.database).query(
      'SELECT id FROM products WHERE id = ANY($1::varchar[])',
      [values],
    );
    const existing = new Set(rows.map((row) => row.id));
    return values.filter((id) => !existing.has(id));
  }

  async findUnclassifiedCompositionProducts(ids, tx) {
    if (!ids.length) return [];
    const { rows } = await (tx ?? this.database).query(
      `SELECT id FROM products WHERE id = ANY($1::varchar[])
       AND NOT is_sellable AND NOT is_pizza_component`,
      [ids.map((id) => id.getValue())],
    );
    return rows.map((row) => row.id);
  }

  async compositionWouldCreateCycle(parentId, childIds, tx) {
    if (!childIds.length) return false;
    const { rows } = await (tx ?? this.database).query(
      `WITH RECURSIVE descendants(product_id) AS (
         SELECT unnest($2::varchar[])
         UNION
         SELECT item.child_product_id
         FROM product_composition_items item
         JOIN descendants d ON item.parent_product_id = d.product_id
       )
       SELECT EXISTS(
         SELECT 1 FROM descendants WHERE product_id = $1
       ) AS creates_cycle`,
      [parentId.getValue(), childIds.map((id) => id.getValue())],
    );
    return rows[0].creates_cycle;
  }
}
