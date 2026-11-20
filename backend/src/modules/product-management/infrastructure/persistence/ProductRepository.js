
import { AppError } from '../../../../shared/errors/AppError.js';
import { ProductId } from '../../domain/model/ProductId.js';
import { PRODUCT_NOT_FOUND } from '../../application/services/ProductService.js';
import { ProductRowMapper } from './ProductRowMapper.js';

const COLUMNS = `p.id, p.name, p.description, p.category_id, p.is_sellable,
  p.is_pizza_component, p.acquisition_type, p.is_active,
  p.pizza_component_type_id, p.pricing_mode, p.base_price_amount,
  p.base_price_currency, p.created_at, p.updated_at,
  ARRAY(SELECT pa.allergen_id FROM product_allergens pa
        WHERE pa.product_id = p.id ORDER BY pa.allergen_id) AS allergen_ids,
  COALESCE((SELECT json_agg(json_build_object(
      'productId', pci.child_product_id, 'quantity', pci.quantity
    ) ORDER BY pci.child_product_id)
    FROM product_composition_items pci WHERE pci.parent_product_id = p.id),
    '[]'::json) AS composition_items`;

// Escapes LIKE wildcards so user input is always matched literally.
const like = (text) => `%${text.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;

function mapWriteError(error) {
  if (error instanceof AppError) throw error;
  if (error.code === '23505')
    throw new AppError('Product identifier already exists', 409);
  // A referenced category / component type / allergen disappeared concurrently.
  if (error.code === '23503')
    throw new AppError(
      'Referenced product category, pizza component type or allergen not found',
      404,
    );
  if (
    error.code === '23514' &&
    /composition cannot contain a cycle/i.test(error.message)
  )
    throw new AppError('Product composition cannot contain a cycle', 409);
  if (error.code === '23514') throw new AppError('Invalid product data', 400);
  throw error;
}

/** PostgreSQL adapter of IProductRepository. All queries are parameterized. */
export class ProductRepository {
  #loaded = new WeakSet();

  constructor(database) {
    this.database = database;
  }

  #client(tx) {
    return tx ?? this.database;
  }

  #remember(row) {
    const product = ProductRowMapper.toDomain(row);
    this.#loaded.add(product);
    return product;
  }

  async nextId(tx) {
    const { rows } = await this.#client(tx).query(
      // GREATEST keeps every digit: lpad alone truncates values above 99999 (duplicate ids).
      `SELECT 'PROD-' || lpad(n::text, GREATEST(5, length(n::text)), '0') AS id
       FROM (SELECT nextval('product_id_seq') AS n) generated`,
    );
    return ProductId.create(rows[0].id);
  }

  async findById(id, tx) {
    const { rows } = await this.#client(tx).query(
      `SELECT ${COLUMNS} FROM products p WHERE p.id = $1`,
      [id.getValue()],
    );
    return rows[0] ? this.#remember(rows[0]) : null;
  }

  async findByIdForUpdate(id, tx) {
    if (!tx) throw new TypeError('findByIdForUpdate requires a transaction');
    const { rows } = await tx.query(
      `SELECT ${COLUMNS} FROM products p WHERE p.id = $1 FOR UPDATE OF p`,
      [id.getValue()],
    );
    return rows[0] ? this.#remember(rows[0]) : null;
  }

  /** @param {import('../../domain/search/ProductSearchCriteria.js').ProductSearchCriteria} criteria */
  async search(criteria) {
    const conditions = [];
    const values = [];
    const add = (sql, value) => {
      values.push(value);
      conditions.push(sql.replace('?', `$${values.length}`));
    };
    if (criteria.name)
      add(`lower(p.name) LIKE ? ESCAPE '\\'`, like(criteria.name));
    if (criteria.categoryId)
      add('p.category_id = ?', criteria.categoryId.getValue());
    if (criteria.pizzaComponentTypeId)
      add(
        'p.pizza_component_type_id = ?',
        criteria.pizzaComponentTypeId.getValue(),
      );
    for (const [field, column] of [
      ['isSellable', 'is_sellable'],
      ['isPizzaComponent', 'is_pizza_component'],
      ['isActive', 'is_active'],
    ])
      if (criteria[field] !== undefined) add(`p.${column} = ?`, criteria[field]);
    if (criteria.acquisitionType !== undefined)
      add('p.acquisition_type = ?', criteria.acquisitionType);
    // An excluded allergen hides the product when the product itself or any
    // product in its composition, at any depth, has it (WEB05 BR, PR #314).
    // UNION (not UNION ALL) stops on repeated products.
    if (criteria.excludeAllergenIds.length)
      add(
        `NOT EXISTS (
           WITH RECURSIVE composed(product_id) AS (
             SELECT p.id
             UNION
             SELECT pci.child_product_id
               FROM product_composition_items pci
               JOIN composed c ON pci.parent_product_id = c.product_id
           )
           SELECT 1 FROM composed c
             JOIN product_allergens pa ON pa.product_id = c.product_id
            WHERE pa.allergen_id = ANY(?::smallint[]))`,
        criteria.excludeAllergenIds.map((id) => id.getValue()),
      );
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS} FROM products p ${where} ORDER BY lower(p.name), p.id`,
      values,
    );
    return rows.map((row) => this.#remember(row));
  }

  async listPredefinedPizzas() {
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS} FROM products p
        WHERE p.is_sellable = TRUE AND p.is_pizza_component = FALSE
          AND p.pricing_mode = 'COMPONENT_BASED'
          AND EXISTS (SELECT 1 FROM product_composition_items ci WHERE ci.parent_product_id = p.id)
        ORDER BY lower(p.name), p.id`,
    );
    return rows.map((row) => this.#remember(row));
  }

  /**
   * Inserts a new product or updates one previously loaded by this adapter, and
   * replaces its allergen links. Runs in `tx` or, without it, in its own transaction.
   */
  async save(product, tx) {
    const row = ProductRowMapper.toPersistence(product);
    const isNew = !this.#loaded.has(product);
    const work = async (client) => {
      try {
        if (isNew) {
          await client.query(
            `INSERT INTO products (id, name, description, category_id, is_sellable,
               is_pizza_component, acquisition_type, is_active,
               pizza_component_type_id, pricing_mode, base_price_amount,
               base_price_currency, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              row.id, row.name, row.description, row.category_id,
              row.is_sellable, row.is_pizza_component, row.acquisition_type,
              row.is_active, row.pizza_component_type_id, row.pricing_mode,
              row.base_price_amount, row.base_price_currency,
              row.created_at, row.updated_at,
            ],
          );
        } else {
          const result = await client.query(
            `UPDATE products SET name = $2, description = $3, category_id = $4,
               is_sellable = $5, is_pizza_component = $6, acquisition_type = $7,
               is_active = $8, pizza_component_type_id = $9, pricing_mode = $10,
               base_price_amount = $11, base_price_currency = $12, updated_at = $13
             WHERE id = $1`,
            [
              row.id, row.name, row.description, row.category_id,
              row.is_sellable, row.is_pizza_component, row.acquisition_type,
              row.is_active, row.pizza_component_type_id, row.pricing_mode,
              row.base_price_amount, row.base_price_currency, row.updated_at,
            ],
          );
          if (result.rowCount === 0) throw new AppError(PRODUCT_NOT_FOUND, 404);
          await client.query(
            'DELETE FROM product_allergens WHERE product_id = $1',
            [row.id],
          );
        }
        if (row.allergen_ids.length)
          await client.query(
            `INSERT INTO product_allergens (product_id, allergen_id)
             SELECT $1, unnest($2::smallint[])`,
            [row.id, row.allergen_ids],
          );
        await client.query(
          'DELETE FROM product_composition_items WHERE parent_product_id = $1',
          [row.id],
        );
        const composition = product.getCompositionItems();
        if (composition.length)
          await client.query(
            `INSERT INTO product_composition_items (parent_product_id, child_product_id, quantity)
             SELECT $1, item.product_id, item.quantity
               FROM unnest($2::varchar[], $3::integer[]) AS item(product_id, quantity)`,
            [
              row.id,
              composition.map((item) => item.getProductId().getValue()),
              composition.map((item) => item.getQuantity().getAmount()),
            ],
          );
        const { rows } = await client.query(
          `SELECT ${COLUMNS} FROM products p WHERE p.id = $1`,
          [row.id],
        );
        return this.#remember(rows[0]);
      } catch (error) {
        mapWriteError(error);
      }
    };
    return tx ? work(tx) : this.database.withTransaction(work);
  }
}
