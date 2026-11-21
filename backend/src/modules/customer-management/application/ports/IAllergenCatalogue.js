/** GDP01: reads allergen names so a customer can select allergens by id. */
export class IAllergenCatalogue {
  /** @returns {Promise<Array<{ id: number, name: string }>>} */
  async findByIds() {
    throw new Error('Not implemented');
  }
}