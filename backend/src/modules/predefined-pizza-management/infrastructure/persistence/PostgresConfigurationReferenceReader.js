import { AppError } from '../../../../shared/errors/AppError.js';
import {
  ComponentEligibility,
  ConfigurationFacts,
  ProductEligibility,
  TypeCardinalityRule,
} from '../../domain/model/ConfigurationFacts.js';

export class PostgresConfigurationReferenceReader {
  constructor(database) {
    if (!database?.query)
      throw new TypeError('A PostgreSQL database is required');
    this.database = database;
  }

  async readFacts(productId, componentIds, tx) {
    const client = tx ?? this.database;
    const { rows: representativeRows } = await client.query(
      'SELECT id, is_sellable, is_pizza_component FROM products WHERE id = $1',
      [productId],
    );
    const representative = representativeRows[0];
    if (!representative)
      throw new AppError('Representative Product not found', 404);

    const [componentResult, typeResult, sizeResult] = await Promise.all([
      client.query(
        'SELECT id, is_active, is_pizza_component, pizza_component_type_id FROM products WHERE id = ANY($1::varchar[])',
        [componentIds],
      ),
      client.query(
        'SELECT id, min_quantity, max_quantity FROM pizza_component_types ORDER BY id FOR SHARE',
        [],
      ),
      client.query(
        `SELECT size.id
           FROM pizza_sizes size
          WHERE size.active = TRUE
            AND NOT EXISTS (
              SELECT 1
                FROM unnest($1::varchar[]) AS selected(component_product_id)
               WHERE NOT EXISTS (
                 SELECT 1
                   FROM component_size_configurations configuration
                  WHERE configuration.product_id = selected.component_product_id
                    AND configuration.size_id = size.id
               )
            )
          ORDER BY size.id`,
        [componentIds],
      ),
    ]);

    return new ConfigurationFacts({
      representativeProduct: new ProductEligibility({
        productId: representative.id,
        isSellable: representative.is_sellable,
        isPizzaComponent: representative.is_pizza_component,
      }),
      components: componentResult.rows.map(
        (row) =>
          new ComponentEligibility({
            productId: row.id,
            isActive: row.is_active,
            isPizzaComponent: row.is_pizza_component,
            componentTypeId: row.pizza_component_type_id,
          }),
      ),
      typeRules: typeResult.rows.map(
        (row) =>
          new TypeCardinalityRule({
            componentTypeId: row.id,
            minQuantity: row.min_quantity,
            maxQuantity: row.max_quantity,
          }),
      ),
      activeStructurallyEligibleSizes: sizeResult.rows.map((row) => row.id),
    });
  }
}
