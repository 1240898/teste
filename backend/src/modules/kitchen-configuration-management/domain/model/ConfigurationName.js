import { AppError } from '../../../../shared/errors/AppError.js';

export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 80;

/** Descriptive name: trimmed, 3-80 characters, unique case-insensitively (BR 2). */
export class ConfigurationName {
  #value;
  constructor(value) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed.length < MIN_NAME_LENGTH || trimmed.length > MAX_NAME_LENGTH)
      throw new AppError(
        `The configuration name must have between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters`,
      );
    this.#value = trimmed;
    Object.freeze(this);
  }
  static create(value) {
    return value instanceof ConfigurationName
      ? value
      : new ConfigurationName(value);
  }
  getValue() {
    return this.#value;
  }
  /** Comparison key of the unique index on lower(name). */
  getKey() {
    return this.#value.toLowerCase();
  }
}