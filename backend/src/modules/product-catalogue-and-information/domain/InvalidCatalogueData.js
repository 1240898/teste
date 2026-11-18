/** Indicates that persisted business data cannot form a valid catalogue entry. */
export class InvalidCatalogueData extends Error {
  constructor(message = 'Catalogue data is inconsistent') {
    super(message);
    this.name = 'InvalidCatalogueData';
  }
}
