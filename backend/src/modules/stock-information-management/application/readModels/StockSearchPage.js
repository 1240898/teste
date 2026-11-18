export class StockSearchPage {
  constructor({ items, totalItems }) {
    this.items = Object.freeze([...items]);
    this.totalItems = totalItems;
    Object.freeze(this);
  }
}
