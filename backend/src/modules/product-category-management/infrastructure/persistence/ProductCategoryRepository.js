import { AppError } from '../../../../shared/errors/AppError.js';
import { CategoryId } from '../../domain/model/CategoryId.js';
import { REFERENCED_MESSAGE } from '../../application/services/ProductCategoryService.js';
import { ProductCategoryRowMapper } from './ProductCategoryRowMapper.js';

const columns = 'id, name, created_at, updated_at';
const NAME_KEY = 'product_categories_name_key';
// Escapes LIKE wildcards so user input is always matched literally.
const like = (text) => `%${text.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;

export class ProductCategoryRepository {
  #loaded = new WeakSet();
  constructor(database) {
    this.database = database;
  }
  #remember(row) {
    const category = ProductCategoryRowMapper.toDomain(row);
    this.#loaded.add(category);
    return category;
  }
    async nextId() {
    const { rows } = await this.database.query(
      // GREATEST keeps every digit: lpad alone truncates values above 99999 (duplicate ids).
      `SELECT 'CAT-' || lpad(n::text, GREATEST(5, length(n::text)), '0') AS id
       FROM (SELECT nextval('product_category_id_seq') AS n) generated`,
    );
    return CategoryId.create(rows[0].id);
  }
  async findById(id) {
    const { rows } = await this.database.query(
      `SELECT ${columns} FROM product_categories WHERE id = $1`,
      [id.getValue()],
    );
    return rows[0] ? this.#remember(rows[0]) : null;
  }
  async findByName(name) {
    const { rows } = await this.database.query(
      `SELECT ${columns} FROM product_categories WHERE lower(name) = lower($1)`,
      [name.getValue()],
    );
    return rows[0] ? this.#remember(rows[0]) : null;
  }
  async existsByName(name) {
    const { rows } = await this.database.query(
      'SELECT EXISTS(SELECT 1 FROM product_categories WHERE lower(name) = lower($1)) AS exists',
      [name.getValue()],
    );
    return rows[0].exists;
  }
  async findAll({ name, id } = {}) {
    const conditions = [];
    const values = [];
    if (name) {
      values.push(like(name));
      conditions.push(`lower(name) LIKE $${values.length} ESCAPE '\\'`);
    }
    if (id) {
      values.push(like(id));
      conditions.push(`lower(id) LIKE $${values.length} ESCAPE '\\'`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.database.query(
      `SELECT ${columns} FROM product_categories ${where} ORDER BY created_at, id`,
      values,
    );
    return rows.map((row) => this.#remember(row));
  }
  async save(category) {
    const row = ProductCategoryRowMapper.toPersistence(category);
    try {
      let result;
      if (!this.#loaded.has(category)) {
        result = await this.database.query(
          `INSERT INTO product_categories (id, name, created_at, updated_at)
           VALUES ($1, $2, $3, $4) RETURNING ${columns}`,
          [row.id, row.name, row.created_at, row.updated_at],
        );
      } else {
        result = await this.database.query(
          `UPDATE product_categories SET name = $2, updated_at = now()
           WHERE id = $1 RETURNING ${columns}`,
          [row.id, row.name],
        );
      }
      if (!result.rows[0]) throw new AppError('Category not found', 404);
      return this.#remember(result.rows[0]);
    } catch (error) {
      if (error.code === '23505' && error.constraint === NAME_KEY)
        throw new AppError('Category name already exists', 409);
      throw error;
    }
  }
  async delete(id) {
    try {
      const result = await this.database.query(
        'DELETE FROM product_categories WHERE id = $1',
        [id.getValue()],
      );
      if (result.rowCount === 0) throw new AppError('Category not found', 404);
    } catch (error) {
      // ON DELETE RESTRICT raises 23001 (restrict_violation); NO ACTION / deferred
      // foreign keys raise 23503 (foreign_key_violation). Both mean "still referenced".
      if (['23001', '23503'].includes(error.code))
        throw new AppError(REFERENCED_MESSAGE, 409);
      throw error;
    }
  }
  async isReferencedByProducts(id) {
    // The products table only exists once BCK05 is migrated; until then nothing can
    // reference a category.
    const { rows: table } = await this.database.query(
      `SELECT to_regclass('products') IS NOT NULL AS present`,
    );
    if (!table[0].present) return false;
    const { rows } = await this.database.query(
      'SELECT EXISTS(SELECT 1 FROM products WHERE category_id = $1) AS referenced',
      [id.getValue()],
    );
    return rows[0].referenced;
  }
}
