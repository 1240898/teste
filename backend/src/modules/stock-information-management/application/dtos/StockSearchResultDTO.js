export class StockSearchResultDTO {
  constructor({ items, page, pageSize, totalItems }) {
    Object.assign(this, { items, page, pageSize, totalItems });
    Object.freeze(this);
  }
}
