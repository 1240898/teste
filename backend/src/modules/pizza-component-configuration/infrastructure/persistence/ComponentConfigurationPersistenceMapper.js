import { ComponentSizeConfiguration } from '../../domain/model/ComponentSizeConfiguration.js';
import { Money, StockUnitsConsumed } from '../../domain/model/values.js';

const scalar = (identifier) =>
  typeof identifier?.getValue === 'function'
    ? identifier.getValue()
    : identifier;

export class ComponentConfigurationPersistenceMapper {
  static toDomain(row, product, size) {
    return ComponentSizeConfiguration.create(
      {
        getId: () => product.getId(),
        isPizzaComponent: () => product.isPizzaComponent(),
        // A saved configuration may predate a change to stock tracking.
        isStockControlled: () => row.stock_units_consumed !== null,
      },
      size,
      Money.create(String(row.price_amount), row.price_currency),
      row.stock_units_consumed === null
        ? null
        : StockUnitsConsumed.create(
            Number(row.stock_units_consumed),
          ).getUnits(),
    );
  }

  static toRow(configuration) {
    return {
      product_id: scalar(configuration.getProductId()),
      size_id: scalar(configuration.getSizeId()),
      price_amount: configuration.getPrice().getAmount(),
      price_currency: configuration.getPrice().getCurrency(),
      stock_units_consumed:
        configuration.getStockUnitsConsumed()?.getUnits() ?? null,
    };
  }
}
