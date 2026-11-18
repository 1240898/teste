import { ProductId } from '../../domain/model/values.js';
import { ProductStockStatus } from '../../application/readModels/ProductStockStatus.js';

export class ProductModuleProductReader {
  constructor(database) {
    this.database = database;
  }

  async getByIdForUpdate(productId, tx) {
    const id =
      productId instanceof ProductId ? productId : ProductId.create(productId);
    const { rows } = await tx.query(
      `SELECT id AS product_id, name AS product_name, is_active
       FROM products WHERE id = $1 FOR UPDATE`,
      [id.getValue()],
    );
    if (!rows[0]) return null;
    return new ProductStockStatus({
      productId: ProductId.create(rows[0].product_id),
      productName: rows[0].product_name,
      isActive: rows[0].is_active,
    });
  }
}
