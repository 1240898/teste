import { PredefinedPizzaResponseDTO } from '../dtos/PredefinedPizzaResponseDTO.js';

export class PredefinedPizzaResponseMapper {
  static toDTO(pizza) {
    return new PredefinedPizzaResponseDTO({
      id: pizza.getId().getValue(),
      componentIds: pizza
        .getCompositionItems()
        .map((item) => item.getProductId().getValue()),
    });
  }
}
