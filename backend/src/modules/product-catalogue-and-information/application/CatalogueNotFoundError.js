export class CatalogueNotFoundError extends Error {
  constructor(message = 'Product not found') {
    super(message);
    this.name = 'CatalogueNotFoundError';
  }
}
