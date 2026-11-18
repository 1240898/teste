/** Explicit allowlist of the allergen data exposed by the REST API. */
export class AllergenResponseDTO {
  constructor({ id, name, createdAt, updatedAt }) {
    this.id = id;
    this.name = name;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}