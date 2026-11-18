import { AppError } from '../../../../shared/errors/AppError.js';
import { PizzaComponentType } from '../../domain/model/PizzaComponentType.js';
import {
  ComponentTypeId,
  ComponentTypeName,
} from '../../domain/model/values.js';

const columns = 'id, name, assembly_order, min_quantity, max_quantity';

function toDomain(row) {
  return PizzaComponentType.create(
    ComponentTypeId.create(row.id),
    ComponentTypeName.create(row.name),
    row.assembly_order,
    row.min_quantity,
    row.max_quantity,
  );
}

function toValues(type) {
  return [
    type.getId().getValue(),
    type.getName().getValue(),
    type.getAssemblyOrder(),
    type.getMinQuantity(),
    type.getMaxQuantity(),
  ];
}

function mapConstraintError(error) {
  if (error.code === '23505') {
    if (error.constraint === 'pizza_component_types_assembly_order_key')
      throw new AppError('Assembly order already exists', 409);
    if (error.constraint === 'pizza_component_types_name_ci_key')
      throw new AppError('Component type name already exists', 409);
  }
  if (error.code === '23503')
    throw new AppError('Component type is still referenced', 409);
  throw error;
}

export class PostgresComponentTypeRepository {
  constructor(database) {
    this.database = database;
  }

  async nextId(tx) {
    const { rows } = await tx.query(
      "SELECT nextval('pizza_component_type_id_seq') AS value",
    );
    return `type-${String(rows[0].value).padStart(2, '0')}`;
  }

  async findById(id, tx) {
    const client = tx ?? this.database;
    const { rows } = await client.query(
      `SELECT ${columns} FROM pizza_component_types WHERE id = $1`,
      [id.getValue()],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async search(criteria) {
    const conditions = [];
    const values = [];
    if (criteria.id) {
      values.push(criteria.id.getValue());
      conditions.push(`id = $${values.length}`);
    }
    if (criteria.name !== undefined) {
      values.push(criteria.name);
      conditions.push(`lower(name) = lower($${values.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' OR ')}` : '';
    const { rows } = await this.database.query(
      `SELECT ${columns} FROM pizza_component_types ${where} ORDER BY assembly_order, id`,
      values,
    );
    return rows.map(toDomain);
  }

  async findByIdForUpdate(id, tx) {
    const { rows } = await tx.query(
      `SELECT ${columns} FROM pizza_component_types WHERE id = $1 FOR UPDATE`,
      [id.getValue()],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async existsByOrder(order, excludingId, tx) {
    const values = [order];
    let exclusion = '';
    if (excludingId) {
      values.push(excludingId.getValue());
      exclusion = ' AND id <> $2';
    }
    const { rows } = await tx.query(
      `SELECT EXISTS(SELECT 1 FROM pizza_component_types WHERE assembly_order = $1${exclusion}) AS exists`,
      values,
    );
    return rows[0].exists;
  }

  async insert(type, tx) {
    try {
      await tx.query(
        `INSERT INTO pizza_component_types (${columns}) VALUES ($1, $2, $3, $4, $5)`,
        toValues(type),
      );
    } catch (error) {
      mapConstraintError(error);
    }
  }

  async save(type, tx) {
    try {
      const values = toValues(type);
      const { rows } = await tx.query(
        `UPDATE pizza_component_types SET name = $2, assembly_order = $3, min_quantity = $4, max_quantity = $5 WHERE id = $1 RETURNING id`,
        values,
      );
      if (!rows[0]) throw new AppError('Pizza component type not found', 404);
    } catch (error) {
      mapConstraintError(error);
    }
  }

  async delete(id, tx) {
    try {
      const { rows } = await tx.query(
        'DELETE FROM pizza_component_types WHERE id = $1 RETURNING id',
        [id.getValue()],
      );
      if (!rows[0]) throw new AppError('Pizza component type not found', 404);
    } catch (error) {
      mapConstraintError(error);
    }
  }
}
