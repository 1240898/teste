import { AppError } from '../../../../shared/errors/AppError.js';
import { PizzaSizeMapper } from './PizzaSizeMapper.js';

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

export class PizzaSizeRepository {
  constructor(database) {
    this.database = database;
  }
    async nextId() {
    const { rows } = await this.database.query(
      // GREATEST keeps every digit: lpad alone truncates values above 9999 (duplicate ids).
      "SELECT 'PSIZE-' || lpad(n::text, GREATEST(4, length(n::text)), '0') AS id FROM (SELECT nextval('pizza_size_id_seq') AS n) generated",
    );
    return rows[0].id;
  }
  async findById(id, tx) {
    const client = tx ?? this.database;
    const { rows } = await client.query(
      'SELECT * FROM pizza_sizes WHERE id = $1',
      [id.getValue()],
    );
    return rows[0] ? PizzaSizeMapper.toDomain(rows[0]) : null;
  }
  async findByIdForUpdate(id, tx) {
    if (!tx) throw new TypeError('findByIdForUpdate requires a transaction');
    const { rows } = await tx.query(
      'SELECT * FROM pizza_sizes WHERE id = $1 FOR UPDATE',
      [id.getValue()],
    );
    return rows[0] ? PizzaSizeMapper.toDomain(rows[0]) : null;
  }
  async findByName(name) {
    const { rows } = await this.database.query(
      'SELECT * FROM pizza_sizes WHERE lower(name) = lower($1)',
      [name],
    );
    return rows[0] ? PizzaSizeMapper.toDomain(rows[0]) : null;
  }
  async save(pizzaSize) {
    const value = PizzaSizeMapper.toPersistence(pizzaSize);
    try {
      const { rows } = await this.database.query(
        'INSERT INTO pizza_sizes (id, name, active) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now() RETURNING *',
        [value.id, value.name, value.active],
      );
      return PizzaSizeMapper.toDomain(rows[0]);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'pizza_sizes_name_key')
        throw new AppError('Pizza size name already exists', 409);
      throw error;
    }
  }
  async search(criteria) {
    const clauses = [];
    const values = [];
    for (const field of ['id', 'name']) {
      const value = criteria[field];
      if (value?.trim()) {
        values.push(`%${value.trim().replace(/[\\%_]/g, '\\$&')}%`);
        clauses.push(`${field} ILIKE $${values.length} ESCAPE E'\\\\'`);
      }
    }
    if (criteria.active !== undefined) {
      values.push(criteria.active);
      clauses.push(`active = $${values.length}`);
    }
    const { rows } = await this.database.query(
      `SELECT * FROM pizza_sizes ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY name, id`,
      values,
    );
    return rows.map(PizzaSizeMapper.toDomain);
  }
  async isReferencedByOtherEntities(id) {
    const { rows: references } = await this.database.query(
      `SELECT child_namespace.nspname AS schema_name, child_table.relname AS table_name, child_column.attname AS column_name
       FROM pg_constraint AS foreign_key
       JOIN pg_class AS child_table ON child_table.oid = foreign_key.conrelid
       JOIN pg_namespace AS child_namespace ON child_namespace.oid = child_table.relnamespace
       JOIN LATERAL unnest(foreign_key.conkey) WITH ORDINALITY AS child_key(attnum, position) ON TRUE
       JOIN LATERAL unnest(foreign_key.confkey) WITH ORDINALITY AS parent_key(attnum, position) ON parent_key.position = child_key.position
       JOIN pg_attribute AS child_column ON child_column.attrelid = foreign_key.conrelid AND child_column.attnum = child_key.attnum
       JOIN pg_attribute AS parent_column ON parent_column.attrelid = foreign_key.confrelid AND parent_column.attnum = parent_key.attnum
       WHERE foreign_key.contype = 'f' AND foreign_key.confrelid = to_regclass('pizza_sizes') AND parent_column.attname = 'id'`,
    );
    for (const reference of references) {
      const table = `${quoteIdentifier(reference.schema_name)}.${quoteIdentifier(reference.table_name)}`;
      const column = quoteIdentifier(reference.column_name);
      const { rows } = await this.database.query(
        `SELECT EXISTS (SELECT 1 FROM ${table} WHERE ${column} = $1) AS referenced`,
        [id.getValue()],
      );
      if (rows[0].referenced) return true;
    }
    return false;
  }
  async delete(id) {
    try {
      const { rowCount } = await this.database.query(
        'DELETE FROM pizza_sizes WHERE id = $1',
        [id.getValue()],
      );
      if (!rowCount) throw new AppError('Pizza size not found', 404);
    } catch (error) {
      if (error.code === '23503')
        throw new AppError('Pizza size is referenced and cannot be deleted', 409);
      throw error;
    }
  }
}
