/** Application query-port contract implemented by PostgresCatalogueReader. */
export class ICatalogueReader {
  async loadSellable() {
    throw new Error('ICatalogueReader.loadSellable must be implemented');
  }

  async loadFor(_productId) {
    throw new Error('ICatalogueReader.loadFor must be implemented');
  }
}
