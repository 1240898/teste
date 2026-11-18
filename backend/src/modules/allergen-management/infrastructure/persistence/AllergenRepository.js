import { AppError } from '../../../../shared/errors/AppError.js';
import {
  ID_CONFLICT_MESSAGE,
  NAME_CONFLICT_MESSAGE,
  REFERENCED_MESSAGE,
} from '../../application/services/AllergenService.js';
import { AllergenRowMapper } from './AllergenRowMapper.js';

const columns = 'id, name, created_at, updated_at';
const NAME_KEY = 'allergens_name_key';
const PRIMARY_KEY = 'allergens_pkey';
// Escapes LIKE wildcards so user input is always matched literally.
const like = (text) => `%${text.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;

/**
 * Tables owned by other modules that reference allergens (BR3). They are created by
 * BCK05 / BCK02 migrations; until a table exists nothing in it can reference an allergen.
 */
export const REFERENCING_TABLES = Object.freeze([
  'product_allergens',
  'customer_dietary_restriction_allergens',
]);

export class AllergenRepository {
  #loaded = new WeakSet();
  constructor(database) {
    this.database = database;
  }
  #remember(row) {
    const allergen = AllergenRowMapper.toDomain(row);
    this.#loaded.add(allergen);
    return allergen;
  }
  async findById(id) {
    const { rows } = await this.database.query(
      `SELECT ${columns} FROM allergens WHERE id = $1`,
      [id.getValue()],
    );
    return rows[0] ? this.#remember(rows[0]) : null;
  }
  async findByName(name) {
    const { rows } = await this.database.query(
      `SELECT ${columns} FROM allergens WHERE lower(name) = lower($1)`,
      [name.getValue()],
    );
    return rows[0] ? this.#remember(rows[0]) : null;
  }
  async existsByName(name) {
    const { rows } = await this.database.query(
      'SELECT EXISTS(SELECT 1 FROM allergens WHERE lower(name) = lower($1)) AS exists',
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
      values.push(id.getValue());
      conditions.push(`id = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.database.query(
      `SELECT ${columns} FROM allergens ${where} ORDER BY id`,
      values,
    );
    return rows.map((row) => this.#remember(row));
  }
  async save(allergen) {
    const row = AllergenRowMapper.toPersistence(allergen);
    try {
      let result;
      if (!this.#loaded.has(allergen)) {
        result = await this.database.query(
          `INSERT INTO allergens (id, name, created_at, updated_at)
           VALUES ($1, $2, $3, $4) RETURNING ${columns}`,
          [row.id, row.name, row.created_at, row.updated_at],
        );
      } else {
        result = await this.database.query(
          `UPDATE allergens SET name = $2, updated_at = now()
           WHERE id = $1 RETURNING ${columns}`,
          [row.id, row.name],
        );
      }
      if (!result.rows[0]) throw new AppError('Allergen not found', 404);
      return this.#remember(result.rows[0]);
    } catch (error) {
      // BR5: unique violations raised under concurrency become 409 Conflict.
      if (error.code === '23505' && error.constraint === NAME_KEY)
        throw new AppError(NAME_CONFLICT_MESSAGE, 409);
      if (error.code === '23505' && error.constraint === PRIMARY_KEY)
        throw new AppError(ID_CONFLICT_MESSAGE, 409);
      throw error;
    }
  }
  async delete(id) {
    try {
      const result = await this.database.query(
        'DELETE FROM allergens WHERE id = $1',
        [id.getValue()],
      );
      if (result.rowCount === 0) throw new AppError('Allergen not found', 404);
    } catch (error) {
      // ON DELETE RESTRICT raises 23001 (restrict_violation); NO ACTION / deferred
      // foreign keys raise 23503 (foreign_key_violation). Both mean "still referenced".
      if (['23001', '23503'].includes(error.code))
        throw new AppError(REFERENCED_MESSAGE, 409);
      throw error;
    }
  }
  async isReferenced(id) {
    const { rows: present } = await this.database.query(
      `SELECT name FROM unnest($1::text[]) AS name WHERE to_regclass(name) IS NOT NULL`,
      [REFERENCING_TABLES],
    );
    for (const { name: table } of present) {
      // Table names come from the constant allowlist above, never from user input.
      const { rows } = await this.database.query(
        `SELECT EXISTS(SELECT 1 FROM ${table} WHERE allergen_id = $1) AS referenced`,
        [id.getValue()],
      );
      if (rows[0].referenced) return true;
    }
    return false;
  }
}