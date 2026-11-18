import { CataloguePersistenceMapper } from './CataloguePersistenceMapper.js';

const catalogueQuery = `
WITH roots AS (
  SELECT product.*
  FROM products AS product
  WHERE product.is_sellable = true
    AND ($1::varchar IS NULL OR product.id = $1)
), pizza_rows AS (
  SELECT pizza.id AS product_id,
         COALESCE(
           array_agg(composition.child_product_id ORDER BY composition.child_product_id)
             FILTER (WHERE composition.child_product_id IS NOT NULL),
           ARRAY[]::varchar[]
         ) AS component_ids
  FROM products AS pizza
  JOIN roots ON roots.id = pizza.id
  LEFT JOIN product_composition_items AS composition
    ON composition.parent_product_id = pizza.id
  WHERE pizza.pricing_mode = 'COMPONENT_BASED'
  GROUP BY pizza.id
), relevant_products AS (
  SELECT roots.* FROM roots
  UNION
  SELECT component_product.*
  FROM pizza_rows AS pizza
  CROSS JOIN LATERAL unnest(pizza.component_ids) AS component_id
  JOIN products AS component_product ON component_product.id = component_id
)
SELECT
  COALESCE((
    SELECT jsonb_agg(to_jsonb(root) || jsonb_build_object(
      'allergen_ids', COALESCE((
        SELECT jsonb_agg(link.allergen_id ORDER BY link.allergen_id)
        FROM product_allergens AS link WHERE link.product_id = root.id
      ), '[]'::jsonb),
      'composition_items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('productId', item.child_product_id, 'quantity', item.quantity)
          ORDER BY item.child_product_id)
        FROM product_composition_items AS item WHERE item.parent_product_id = root.id
      ), '[]'::jsonb)
    ) ORDER BY root.id)
    FROM roots AS root
  ), '[]'::jsonb) AS roots,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(product) || jsonb_build_object(
      'allergen_ids', COALESCE((
        SELECT jsonb_agg(link.allergen_id ORDER BY link.allergen_id)
        FROM product_allergens AS link WHERE link.product_id = product.id
      ), '[]'::jsonb),
      'composition_items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('productId', item.child_product_id, 'quantity', item.quantity)
          ORDER BY item.child_product_id)
        FROM product_composition_items AS item WHERE item.parent_product_id = product.id
      ), '[]'::jsonb)
    ) ORDER BY product.id)
    FROM relevant_products AS product
  ), '[]'::jsonb) AS products,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(category) ORDER BY category.id)
    FROM product_categories AS category
    WHERE category.id IN (SELECT DISTINCT category_id FROM relevant_products)
  ), '[]'::jsonb) AS categories,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(allergen) ORDER BY allergen.id)
    FROM allergens AS allergen
    WHERE allergen.id IN (
      SELECT DISTINCT link.allergen_id
      FROM product_allergens AS link
      JOIN relevant_products AS product ON product.id = link.product_id
    )
  ), '[]'::jsonb) AS allergens,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'product_id', pizza.product_id,
      'component_ids', pizza.component_ids
    ) ORDER BY pizza.product_id)
    FROM pizza_rows AS pizza
  ), '[]'::jsonb) AS predefined_pizzas,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'product_id', configuration.product_id,
      'size_id', configuration.size_id,
      'price_amount', configuration.price_amount::text,
      'price_currency', configuration.price_currency,
      'stock_units_consumed', configuration.stock_units_consumed
    ) ORDER BY configuration.product_id, configuration.size_id)
    FROM component_size_configurations AS configuration
    WHERE configuration.product_id IN (
      SELECT DISTINCT component_id
      FROM pizza_rows AS pizza
      CROSS JOIN LATERAL unnest(pizza.component_ids) AS component_id
    )
  ), '[]'::jsonb) AS component_size_configurations,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(size) ORDER BY lower(size.name), size.id)
    FROM pizza_sizes AS size
  ), '[]'::jsonb) AS sizes,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'stock_code', stock.stock_code,
      'product_id', stock.product_id,
      'available_units', stock.available_units,
      'started_at', stock.started_at,
      'ended_at', stock.ended_at
    ) ORDER BY stock.product_id)
    FROM stock_information AS stock
    WHERE stock.ended_at IS NULL
      AND stock.product_id IN (SELECT id FROM relevant_products)
  ), '[]'::jsonb) AS stock_records`;

export class PostgresCatalogueReader {
  constructor(database, mapper = CataloguePersistenceMapper) {
    if (!database || typeof database.query !== 'function')
      throw new TypeError('Database query facade is required');
    this.database = database;
    this.mapper = mapper;
  }

  async loadSellable() {
    const { rows } = await this.database.query(catalogueQuery, [null]);
    return this.mapper.toFacts(rows);
  }

  async loadFor(productId) {
    const { rows } = await this.database.query(catalogueQuery, [
      productId.getValue(),
    ]);
    return this.mapper.toFacts(rows);
  }
}
