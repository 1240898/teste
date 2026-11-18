import { ProductId } from '../../domain/model/values.js';

export class ProductStockStatus {
  constructor({ productId, productName, isActive }) {
    if (!(productId instanceof ProductId))
      throw new TypeError('ProductStockStatus requires a ProductId');
    Object.assign(this, {
      productId,
      productName,
      isActive,
    });
    Object.freeze(this);
  }
}
