import { Allergen } from '../../domain/model/Allergen.js';
import { AllergenId } from '../../domain/model/AllergenId.js';
import { AllergenName } from '../../domain/model/AllergenName.js';
import { AllergenResponseDTO } from '../dtos/AllergenResponseDTO.js';

export class AllergenMapper {
  static toDomain(dto) {
    return Allergen.create(
      AllergenName.create(dto.name),
      AllergenId.create(dto.id),
    );
  }
  static toDTO(allergen) {
    return new AllergenResponseDTO({
      id: allergen.getId().getValue(),
      name: allergen.getName().getValue(),
      createdAt: allergen.createdAt.toISOString(),
      updatedAt: allergen.updatedAt.toISOString(),
    });
  }
  static toDTOList(allergens) {
    return allergens.map((allergen) => this.toDTO(allergen));
  }
}