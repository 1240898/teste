import { ComponentTypeResponseDTO } from '../dtos/ComponentTypeResponseDTO.js';

export class ComponentTypeResponseMapper {
  static toDTO(type) {
    return new ComponentTypeResponseDTO({
      id: type.getId().getValue(),
      name: type.getName().getValue(),
      assemblyOrder: type.getAssemblyOrder(),
      minQuantity: type.getMinQuantity(),
      maxQuantity: type.getMaxQuantity(),
    });
  }
}
