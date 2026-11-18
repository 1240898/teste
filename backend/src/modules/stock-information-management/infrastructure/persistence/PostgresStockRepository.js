import { randomUUID } from 'node:crypto';
import { AppError } from '../../../../shared/errors/AppError.js';
import { StockSearchPage } from '../../application/readModels/StockSearchPage.js';
import { StockSummary } from '../../application/readModels/StockSummary.js';
import { StockInformation } from '../../domain/model/StockInformation.js';
import {
  AbstractStockQuantity,
  ProductId,
  StockId,
} from '../../domain/model/values.js';

function toDomain(row) {
  return StockInformation.create(
    StockId.create(row.stock_code),
    ProductId.create(row.product_id),
    AbstractStockQuantity.create(row.available_units),
    new Date(row.started_at),
    row.ended_at === null ? null : new Date(row.ended_at),
  );
}

function toSummary(row) {
  return new StockSummary({
    stockId: row.stock_code,
    productId: row.product_id,
    productName: row.product_name,
    availableUnits: row.available_units,
    startedAt: new Date(row.started_at),
    endedAt: row.ended_at === null ? null : new Date(row.ended_at),
  });
}

function mapConstraintError(error) {
  if (error.code === '23505') {
    if (
      error.constraint === 'stock_information_stock_code_key' ||
      error.constraint === 'stock_information_one_current_per_product_key'
    )
      throw new AppError(
        'Stock information already exists for this Product',
        409,
      );
  }
  if (error.code === '23503') throw new AppError('Product does not exist', 404);
  if (error.code === '23514')
    throw new AppError('Stock quantity violates a persistence constraint', 400);
  throw error;
}

export class PostgresStockRepository {
  constructor(database) {
    this.database = database;
  }

  async nextId(tx) {
    const { rows } = await tx.query(
      "SELECT nextval('stock_information_id_seq') AS value",
    );
    return `STOCK-${String(rows[0].value).padStart(5, '0')}`;
  }

  async findCurrentSummaryByProductId(productId) {
    const { rows } = await this.database.query(
      `SELECT s.stock_code, s.product_id, p.name AS product_name,
              s.available_units, s.started_at, s.ended_at
       FROM stock_information s
       JOIN products p ON p.id = s.product_id
       WHERE s.product_id = $1
         AND s.ended_at IS NULL`,
      [productId.getValue()],
    );
    return rows[0] ? toSummary(rows[0]) : null;
  }

  async searchPeriods(criteria) {
    const conditions = [
      criteria.historical ? 's.ended_at IS NOT NULL' : 's.ended_at IS NULL',
    ];
    const values = [];
    if (criteria.productId) {
      values.push(criteria.productId.getValue());
      conditions.push(`s.product_id = $${values.length}`);
    }
    if (criteria.productName !== undefined) {
      values.push(`%${criteria.productName}%`);
      conditions.push(`p.name ILIKE $${values.length}`);
    }
    if (criteria.isActive !== undefined) {
      values.push(criteria.isActive);
      conditions.push(`p.is_active = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const from = `FROM stock_information s JOIN products p ON p.id = s.product_id ${where}`;
    const count = await this.database.query(
      `SELECT COUNT(*)::int AS total_items ${from}`,
      values,
    );
    const offset = (criteria.page - 1) * criteria.pageSize;
    const pageValues = [...values, criteria.pageSize, offset];
    const { rows } = await this.database.query(
      `SELECT s.stock_code, s.product_id, p.name AS product_name,
              s.available_units, s.started_at, s.ended_at
       ${from}
       ORDER BY lower(p.name), s.product_id, s.started_at DESC
       LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues,
    );
    return new StockSearchPage({
      items: rows.map(toSummary),
      totalItems: Number(count.rows[0]?.total_items ?? 0),
    });
  }

  async findCurrentByProductIdForUpdate(productId, tx) {
    const { rows } = await tx.query(
      `SELECT stock_code, product_id, available_units, started_at, ended_at
       FROM stock_information
       WHERE product_id = $1 AND ended_at IS NULL
       FOR UPDATE`,
      [productId.getValue()],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async save(stock, tx) {
    try {
      const { rows } = await tx.query(
        `UPDATE stock_information
         SET available_units = $2, ended_at = $3
         WHERE product_id = $1 AND ended_at IS NULL
           AND stock_code = $4
         RETURNING product_id`,
        [
          stock.getProductId().getValue(),
          stock.getAvailableUnits(),
          stock.getEndedAt(),
          stock.getId().getValue(),
        ],
      );
      if (!rows[0]) throw new AppError('Stock information not found', 404);
    } catch (error) {
      mapConstraintError(error);
    }
  }

  async insert(stock, tx) {
    try {
      await tx.query(
        `INSERT INTO stock_information
          (id, stock_code, product_id, available_units, started_at, ended_at)
         VALUES ($1, $2, $3, $4, $5, NULL)`,
        [
          randomUUID(),
          stock.getId().getValue(),
          stock.getProductId().getValue(),
          stock.getAvailableUnits(),
          stock.getStartedAt(),
        ],
      );
    } catch (error) {
      mapConstraintError(error);
    }
  }
}
