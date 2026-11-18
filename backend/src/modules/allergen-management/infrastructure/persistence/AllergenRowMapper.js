import { Allergen } from '../../domain/model/Allergen.js';

/** SQL row mapping only. HTTP response mapping lives in the application layer. */
export class AllergenRowMapper {
  static toDomain(row) {
    return Allergen.restore({
      id: Number(row.id),
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  static toPersistence(allergen) {
    return {
      id: allergen.getId().getValue(),
      name: allergen.getName().getValue(),
      created_at: allergen.createdAt,
      updated_at: allergen.updatedAt,
    };
  }
}