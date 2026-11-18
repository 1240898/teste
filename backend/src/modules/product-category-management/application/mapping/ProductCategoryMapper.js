import { CategoryName } from '../../domain/model/CategoryName.js';
import { ProductCategory } from '../../domain/model/ProductCategory.js';
import { CategoryResponseDTO } from '../dtos/CategoryResponseDTO.js';

export class ProductCategoryMapper {
  static toDomain(dto, id) {
    return ProductCategory.create(CategoryName.create(dto.name), id);
  }
  static toDTO(category) {
    return new CategoryResponseDTO({
      id: category.getId().getValue(),
      name: category.getName().getValue(),
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    });
  }
  static toDTOList(categories) {
    return categories.map((category) => this.toDTO(category));
  }
}
