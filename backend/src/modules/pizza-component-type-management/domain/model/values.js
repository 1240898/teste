import { AppError } from '../../../../shared/errors/AppError.js';

export class ComponentTypeId {
  #value;

  constructor(value) {
    if (typeof value !== 'string' || !value.trim())
      throw new AppError('Invalid component type ID');
    this.#value = value.trim();
    Object.freeze(this);
  }

  static create(value) {
    return new ComponentTypeId(value);
  }

  getValue() {
    return this.#value;
  }

  equals(other) {
    return other instanceof ComponentTypeId && this.#value === other.getValue();
  }
}

export class ComponentTypeName {
  #value;

  constructor(value) {
    if (typeof value !== 'string' || !value.trim())
      throw new AppError('Component type name is required');
    this.#value = value.trim();
    Object.freeze(this);
  }

  static create(value) {
    return new ComponentTypeName(value);
  }

  getValue() {
    return this.#value;
  }

  equals(other) {
    return (
      other instanceof ComponentTypeName && this.#value === other.getValue()
    );
  }
}
