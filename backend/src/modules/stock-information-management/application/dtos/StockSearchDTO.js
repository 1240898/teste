export class StockSearchDTO {
  constructor({
    productId,
    productName,
    isActive,
    historical = false,
    page = 1,
    pageSize = 20,
  } = {}) {
    this.productId = productId;
    this.productName = productName;
    this.isActive = isActive;
    this.historical = historical;
    this.page = page;
    this.pageSize = pageSize;
    Object.freeze(this);
  }
}
