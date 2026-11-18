import { AppError } from '../../../../shared/errors/AppError.js';
import { AllergenId } from './AllergenId.js';
import { AllergenName } from './AllergenName.js';

/** Aggregate root of the Allergen aggregate (BCK04). */
export class Allergen {
  #id;
  #name;
  #createdAt;
  #updatedAt;
  constructor({ id, name, createdAt, updatedAt }) {
    if (
      !(id instanceof AllergenId) ||
      !(name instanceof AllergenName) ||
      ![createdAt, updatedAt].every(
        (date) => date instanceof Date && Number.isFinite(date.getTime()),
      )
    )
      throw new AppError('Invalid allergen state');
    this.#id = id;
    this.#name = name;
    this.#createdAt = createdAt.getTime();
    this.#updatedAt = updatedAt.getTime();
    Object.freeze(this);
  }
  /** Creates a new allergen with its EU identifier (class diagram: create(name, id)). */
  static create(name, id) {
    const now = new Date();
    return new Allergen({ id, name, createdAt: now, updatedAt: now });
  }
  /** Rebuilds a persisted allergen, re-validating every invariant. */
  static restore({ id, name, createdAt, updatedAt }) {
    return new Allergen({
      id: AllergenId.create(id),
      name: AllergenName.create(name),
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
    if (!(newName instanceof AllergenName))
      throw new AppError('Invalid allergen name');
    if (newName.getValue() !== this.#name.getValue()) {
      this.#name = newName;
      this.#updatedAt = Date.now();
    }
  }
}