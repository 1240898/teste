import { AppError } from '../../../../shared/errors/AppError.js';
import { ProductId } from './ProductId.js';
import { Quantity } from './Quantity.js';

/** A child Product and its positive quantity within a parent Product. */
export class ProductCompositionItem {
  #productId;
  #quantity;

  constructor(productId, quantity) {
    if (!(productId instanceof ProductId) || !(quantity instanceof Quantity))
      throw new AppError('Invalid product composition item');
    this.#productId = productId;
    this.#quantity = quantity;
    Object.freeze(this);
  }

  static create(productId, quantity) {
    return new ProductCompositionItem(
      productId instanceof ProductId ? productId : ProductId.create(productId),
      quantity instanceof Quantity ? quantity : Quantity.create(quantity),
    );
  }

  getProductId() {
    return this.#productId;
  }
  getQuantity() {
    return this.#quantity;
  }
}
