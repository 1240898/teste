/** Price and availability for one structurally configured pizza size. */
export class PizzaSizeOffer {
  constructor({ sizeId, sizeName, price, available }) {
    Object.assign(this, { sizeId, sizeName, price, available });
    Object.freeze(this);
  }
}
