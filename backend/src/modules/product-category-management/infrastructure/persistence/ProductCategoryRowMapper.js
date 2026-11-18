import { ProductCategory } from '../../domain/model/ProductCategory.js';

/** SQL row mapping only. HTTP response mapping lives in the application layer. */
export class ProductCategoryRowMapper {
  static toDomain(row) {
    return ProductCategory.restore({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  static toPersistence(category) {
    return {
      id: category.getId().getValue(),
      name: category.getName().getValue(),
      created_at: category.createdAt,
      updated_at: category.updatedAt,
    };
  }
}
