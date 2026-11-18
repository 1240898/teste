import { PizzaSizeDTO } from '../dtos/PizzaSizeDTO.js';

export class PizzaSizeResponseMapper {
  static toDTO(pizzaSize) {
    return new PizzaSizeDTO({
      id: pizzaSize.id.getValue(),
      name: pizzaSize.name.getValue(),
      active: pizzaSize.isActive,
    });
  }
  static toDTOList(pizzaSizes) {
    return pizzaSizes.map(PizzaSizeResponseMapper.toDTO);
  }
}
