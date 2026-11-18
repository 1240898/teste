import { PizzaSize } from '../../domain/model/PizzaSize.js';
import { PizzaSizeId, PizzaSizeName } from '../../domain/model/values.js';

export class PizzaSizeMapper {
  static toDomain(row) {
    return PizzaSize.restore({
      id: PizzaSizeId.create(row.id),
      name: PizzaSizeName.create(row.name),
      isActive: row.active,
    });
  }
  static toPersistence(pizzaSize) {
    return {
      id: pizzaSize.id.getValue(),
      name: pizzaSize.name.getValue(),
      active: pizzaSize.isActive,
    };
  }
}
