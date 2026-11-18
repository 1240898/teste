import { AppError } from '../../../../shared/errors/AppError.js';

const mandatoryTypeIds = new Set(['type-01', 'type-02', 'type-03', 'type-04']);

const invalidConfigurationQuery = `
  SELECT EXISTS (
    SELECT 1
      FROM products pizza
      LEFT JOIN product_composition_items configured
        ON configured.parent_product_id = pizza.id
      LEFT JOIN products component
        ON component.id = configured.child_product_id
     WHERE pizza.pricing_mode = 'COMPONENT_BASED'
     GROUP BY pizza.id
    HAVING COALESCE(SUM(configured.quantity) FILTER (
             WHERE component.pizza_component_type_id = $1
           ), 0) < $2
        OR (
          $3::integer IS NOT NULL
          AND COALESCE(SUM(configured.quantity) FILTER (
                WHERE component.pizza_component_type_id = $1
              ), 0) > $3
        )
  ) AS invalid
`;

export class PostgresComponentTypeImpactGuard {
  async assertSafeCreate(candidate, _tx) {
    if (candidate.getMinQuantity() > 0)
      throw new AppError(
        'New component types must have a minimum quantity of zero',
        409,
      );
  }

  async assertSafeUpdate(current, candidate, tx) {
    const boundsUnchanged =
      current.getMinQuantity() === candidate.getMinQuantity() &&
      current.getMaxQuantity() === candidate.getMaxQuantity();
    if (boundsUnchanged) return;

    const { rows } = await tx.query(invalidConfigurationQuery, [
      candidate.getId().getValue(),
      candidate.getMinQuantity(),
      candidate.getMaxQuantity(),
    ]);

    if (rows[0]?.invalid)
      throw new AppError(
        'Cannot change quantity bounds because a stored predefined pizza would violate the new limits',
        409,
      );
  }

  async assertSafeRemoval(current, _tx) {
    if (mandatoryTypeIds.has(current.getId().getValue()))
      throw new AppError(
        'The four mandatory component types cannot be removed',
        409,
      );
  }
}
