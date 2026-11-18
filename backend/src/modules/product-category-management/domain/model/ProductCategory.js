import { AppError } from '../../../../shared/errors/AppError.js';
import { CategoryId } from './CategoryId.js';
import { CategoryName } from './CategoryName.js';

/** Aggregate root of the Product Category aggregate (BCK03). */
export class ProductCategory {
  #id;
  #name;
  #createdAt;
  #updatedAt;
  constructor({ id, name, createdAt, updatedAt }) {
    if (
      !(id instanceof CategoryId) ||
      !(name instanceof CategoryName) ||
      ![createdAt, updatedAt].every(
        (date) => date instanceof Date && Number.isFinite(date.getTime()),
      )
    )
      throw new AppError('Invalid category state');
    this.#id = id;
    this.#name = name;
    this.#createdAt = createdAt.getTime();
    this.#updatedAt = updatedAt.getTime();
    Object.freeze(this);
  }
  /** Creates a new category; the identifier is allocated by the repository. */
  static create(name, id) {
    const now = new Date();
    return new ProductCategory({ id, name, createdAt: now, updatedAt: now });
  }
  /** Rebuilds a persisted category, re-validating every invariant. */
  static restore({ id, name, createdAt, updatedAt }) {
    return new ProductCategory({
      id: CategoryId.create(id),
      name: CategoryName.create(name),
      createdAt,
      updatedAt,
    });
  }
  getId() {
    return this.#id;
  }
  getName() {
    return this.#name;
  }
  get createdAt() {
    return new Date(this.#createdAt);
  }
  get updatedAt() {
    return new Date(this.#updatedAt);
  }
  updateName(newName) {
    if (!(newName instanceof CategoryName))
      throw new AppError('Invalid category name');
    if (newName.getValue() !== this.#name.getValue()) {
      this.#name = newName;
      this.#updatedAt = Date.now();
    }
  }
}
