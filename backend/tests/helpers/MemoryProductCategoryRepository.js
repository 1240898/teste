import { AppError } from '../../src/shared/errors/AppError.js';
import { CategoryId } from '../../src/modules/product-category-management/domain/model/CategoryId.js';
import { ProductCategoryRowMapper } from '../../src/modules/product-category-management/infrastructure/persistence/ProductCategoryRowMapper.js';

/** In-memory adapter honouring the same contract as the PostgreSQL repository. */
export class MemoryProductCategoryRepository {
  rows = new Map();
  referencedIds = new Set(); // category ids "used" by products (BCK05 stand-in)
  #sequence = 0;
  async nextId() {
    return CategoryId.create(
      `CAT-${String(++this.#sequence).padStart(5, '0')}`,
    );
  }
  async findById(id) {
    const row = this.rows.get(id.getValue());
    return row ? ProductCategoryRowMapper.toDomain(row) : null;
  }
  async findByName(name) {
    const row = [...this.rows.values()].find(
      (r) => r.name.toLowerCase() === name.getValue().toLowerCase(),
    );
    return row ? ProductCategoryRowMapper.toDomain(row) : null;
  }
  async existsByName(name) {
    return Boolean(await this.findByName(name));
  }
  async findAll({ name, id } = {}) {
    return [...this.rows.values()]
      .filter((r) => !name || r.name.toLowerCase().includes(name.toLowerCase()))
      .filter((r) => !id || r.id.toLowerCase().includes(id.toLowerCase()))
      .map((row) => ProductCategoryRowMapper.toDomain(row));
  }
  async save(category) {
    const row = ProductCategoryRowMapper.toPersistence(category);
    const duplicate = [...this.rows.values()].some(
      (r) => r.name.toLowerCase() === row.name.toLowerCase() && r.id !== row.id,
    );
    if (duplicate) throw new AppError('Category name already exists', 409);
    this.rows.set(row.id, row);
    return ProductCategoryRowMapper.toDomain(row);
  }
  async delete(id) {
    if (!this.rows.delete(id.getValue()))
      throw new AppError('Category not found', 404);
  }
  async isReferencedByProducts(id) {
    return this.referencedIds.has(id.getValue());
  }
}
