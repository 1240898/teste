import { ComponentConfigurationResponseDTO } from '../dtos/ComponentConfigurationResponseDTO.js';

const valueOf = (identifier) =>
  typeof identifier?.getValue === 'function'
    ? identifier.getValue()
    : identifier;

export class ComponentConfigurationResponseMapper {
  static toDTO(configuration) {
    const stockUnitsConsumed = configuration.getStockUnitsConsumed();
    return new ComponentConfigurationResponseDTO({
      productId: valueOf(configuration.getProductId()),
      sizeId: valueOf(configuration.getSizeId()),
      amount: configuration.getPrice().getAmount(),
      currency: configuration.getPrice().getCurrency(),
      stockUnitsConsumed: stockUnitsConsumed?.getUnits() ?? null,
    });
  }
}
