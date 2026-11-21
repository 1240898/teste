import { InputError } from '../../planning-inputs/domain/InputError.js';

export async function forecastOptions(tx) {
  const { rows } = await tx.query(`SELECT p.id AS "productId", p.name,
    (p.pricing_mode = 'COMPONENT_BASED') AS "isPizza",
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) ORDER BY s.name, s.id)
      FROM pizza_sizes s WHERE s.active AND p.pricing_mode = 'COMPONENT_BASED'
      AND EXISTS (SELECT 1 FROM product_composition_items i WHERE i.parent_product_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM product_composition_items i
        JOIN products c ON c.id=i.child_product_id
        LEFT JOIN component_size_configurations cfg ON cfg.product_id=c.id AND cfg.size_id=s.id
        WHERE i.parent_product_id=p.id AND (NOT c.is_active OR cfg.product_id IS NULL))
    ), '[]') AS sizes
    FROM products p WHERE p.is_active AND p.is_sellable ORDER BY p.name, p.id`);
  return rows;
}

export async function exportProducts(tx) {
  const { rows } =
    await tx.query(`SELECT p.id AS "productId", p.name, ps.stock_unit AS "stockUnit",
    p.base_price_amount::text AS "cataloguePriceEur"
    FROM products p LEFT JOIN planning_product_settings ps ON ps.product_id=p.id
    WHERE p.is_active AND p.pricing_mode IS DISTINCT FROM 'COMPONENT_BASED' AND (
      (p.is_pizza_component AND (p.acquisition_type='PURCHASED' OR NOT EXISTS
        (SELECT 1 FROM product_composition_items i WHERE i.parent_product_id=p.id)))
      OR (p.is_sellable AND EXISTS (SELECT 1 FROM stock_information s WHERE s.product_id=p.id AND s.ended_at IS NULL)))
    ORDER BY p.name, p.id`);
  const missing = rows.filter((row) => !row.stockUnit);
  if (missing.length)
    throw new InputError(
      'MISSING_STOCK_UNIT',
      'Configure a stock unit for ' +
        missing.map((row) => row.productId).join(', '),
      422,
      'stockUnit',
      missing.map((row) => row.productId).join(', '),
    );
  return rows.map(({ cataloguePriceEur, ...product }) =>
    cataloguePriceEur == null ? product : { ...product, cataloguePriceEur },
  );
}
