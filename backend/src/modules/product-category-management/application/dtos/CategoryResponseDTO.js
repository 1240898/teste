/** Explicit allowlist of the category data exposed by the REST API. */
export class CategoryResponseDTO {
  constructor({ id, name, createdAt, updatedAt }) {
    this.id = id;
    this.name = name;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
