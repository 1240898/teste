import { CategoryName } from '../domain/model/CategoryName.js';

/**
 * Initial product categories (BCK03). The Manager can rename, delete (when unused)
 * or add categories afterwards through /api/v1/categories.
 */
export const DEFAULT_CATEGORY_NAMES = Object.freeze([
  'Beverages',
  'Desserts',
  'Starters',
  'Pizza Ingredients',
]);

/**
 * Loads the initial product categories. Idempotent: a category whose name already
 * exists (case-insensitively) is skipped and does not consume an identifier.
 * Returns the number of categories inserted.
 */
export async function seedProductCategories(database) {
  const names = DEFAULT_CATEGORY_NAMES.map((name) =>
    CategoryName.create(name).getValue(),
  );
  // Same identifier format as ProductCategoryRepository.nextId: GREATEST keeps every
  // digit, because lpad alone truncates values above 99999 (duplicate ids).
  const result = await database.query(
    `INSERT INTO product_categories (id, name)
     SELECT 'CAT-' || lpad(seed.n::text, GREATEST(5, length(seed.n::text)), '0'), seed.name
     FROM (
       SELECT nextval('product_category_id_seq') AS n, ordered.name
       FROM (
         SELECT s.name
         FROM unnest($1::text[]) WITH ORDINALITY AS s(name, position)
         WHERE NOT EXISTS (
           SELECT 1 FROM product_categories c WHERE lower(c.name) = lower(s.name)
         )
         ORDER BY s.position
       ) AS ordered
     ) AS seed
     ON CONFLICT DO NOTHING`,
    [names],
  );
  return result.rowCount;
}