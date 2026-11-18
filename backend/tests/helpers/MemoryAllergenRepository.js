import { AppError } from '../../src/shared/errors/AppError.js';
import { AllergenRowMapper } from '../../src/modules/allergen-management/infrastructure/persistence/AllergenRowMapper.js';

/** In-memory adapter honouring the same contract as the PostgreSQL repository. */
export class MemoryAllergenRepository {
  rows = new Map();
  referencedIds = new Set(); // allergen ids "used" by products / dietary restrictions
  async findById(id) {
    const row = this.rows.get(id.getValue());
    return row ? AllergenRowMapper.toDomain(row) : null;
  }
  async findByName(name) {
    const row = [...this.rows.values()].find(
      (r) => r.name.toLowerCase() === name.getValue().toLowerCase(),
    );
    return row ? AllergenRowMapper.toDomain(row) : null;
  }
  async existsByName(name) {
    return Boolean(await this.findByName(name));
  }
  async findAll({ name, id } = {}) {
    return [...this.rows.values()]
      .filter((r) => !name || r.name.toLowerCase().includes(name.toLowerCase()))
      .filter((r) => !id || r.id === id.getValue())
      .sort((a, b) => a.id - b.id)
      .map((row) => AllergenRowMapper.toDomain(row));
  }
  async save(allergen) {
    const row = AllergenRowMapper.toPersistence(allergen);
    const duplicate = [...this.rows.values()].some(
      (r) => r.name.toLowerCase() === row.name.toLowerCase() && r.id !== row.id,
    );
    if (duplicate) throw new AppError('Allergen name already exists', 409);
    this.rows.set(row.id, row);
    return AllergenRowMapper.toDomain(row);
  }
  async delete(id) {
    if (!this.rows.delete(id.getValue()))
      throw new AppError('Allergen not found', 404);
  }
  async isReferenced(id) {
    return this.referencedIds.has(id.getValue());
  }
}