import { AppError } from '../../../../shared/errors/AppError.js';
import { PizzaSizeId, ProductId } from '../../domain/model/values.js';
import { ComponentConfigurationPersistenceMapper } from './ComponentConfigurationPersistenceMapper.js';

const columns =
  'product_id, size_id, price_amount, price_currency, stock_units_consumed';

const scalar = (identifier) =>
  typeof identifier?.getValue === 'function'
    ? identifier.getValue()
    : identifier;

function mapConstraintError(error) {
  if (error.code === '23505')
    throw new AppError(
      'A component configuration already exists for this product and size',
      409,
    );
  if (error.code === '23503')
    throw new AppError('Product or pizza size reference is invalid', 409);
  throw error;
}

export class PostgresComponentConfigurationRepository {
  constructor(database, { products, sizes } = {}) {
    Object.assign(this, { database, products, sizes });
  }

  async toDomain(row, tx) {
    if (!this.products || !this.sizes)
      throw new TypeError(
        'Product and pizza size repositories are required to map configurations',
      );
    const productId = ProductId.create(String(row.product_id));
    const sizeId = PizzaSizeId.create(String(row.size_id));
    const [product, size] = await Promise.all([
      this.products.findById(productId, tx),
      this.sizes.findById(sizeId, tx),
    ]);
    if (!product) throw new AppError('Product not found', 404);
    if (!size) throw new AppError('Pizza size not found', 404);
    return ComponentConfigurationPersistenceMapper.toDomain(row, product, size);
  }

  async findByPair(productId, sizeId, tx) {
    const client = tx ?? this.database;
    const { rows } = await client.query(
      `SELECT ${columns} FROM component_size_configurations WHERE product_id = $1 AND size_id = $2`,
      [scalar(productId), scalar(sizeId)],
    );
    return rows[0] ? this.toDomain(rows[0], tx) : null;
  }

  async findByPairForUpdate(productId, sizeId, tx) {
    const { rows } = await tx.query(
      `SELECT ${columns} FROM component_size_configurations WHERE product_id = $1 AND size_id = $2 FOR UPDATE`,
      [scalar(productId), scalar(sizeId)],
    );
    return rows[0] ? this.toDomain(rows[0], tx) : null;
  }

  async findByProduct(productId) {
    const { rows } = await this.database.query(
      `SELECT ${columns} FROM component_size_configurations WHERE product_id = $1 ORDER BY size_id`,
      [scalar(productId)],
    );
    return Promise.all(rows.map((row) => this.toDomain(row)));
  }

  async insert(configuration, tx) {
    try {
      const values =
        ComponentConfigurationPersistenceMapper.toRow(configuration);
      await tx.query(
        `INSERT INTO component_size_configurations (${columns}) VALUES ($1, $2, $3, $4, $5)`,
        [
          values.product_id,
          values.size_id,
          values.price_amount,
          values.price_currency,
          values.stock_units_consumed,
        ],
      );
    } catch (error) {
      mapConstraintError(error);
    }
  }

  async save(configuration, tx) {
    try {
      const values =
        ComponentConfigurationPersistenceMapper.toRow(configuration);
      const { rows } = await tx.query(
        `UPDATE component_size_configurations SET price_amount = $3, price_currency = $4, stock_units_consumed = $5 WHERE product_id = $1 AND size_id = $2 RETURNING product_id`,
        [
          values.product_id,
          values.size_id,
          values.price_amount,
          values.price_currency,
          values.stock_units_consumed,
        ],
      );
      if (!rows[0])
        throw new AppError('Component configuration not found', 404);
    } catch (error) {
      mapConstraintError(error);
    }
  }
}
