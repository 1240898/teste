import { AppError } from '../../../../shared/errors/AppError.js';

function validateConfiguration(assemblyOrder, minQuantity, maxQuantity) {
  if (!Number.isInteger(assemblyOrder) || assemblyOrder <= 0)
    throw new AppError('Assembly order must be a positive integer');
  if (!Number.isInteger(minQuantity) || minQuantity < 0)
    throw new AppError('Minimum quantity must be a non-negative integer');
  if (
    maxQuantity !== null &&
    (!Number.isInteger(maxQuantity) || maxQuantity < minQuantity)
  )
    throw new AppError(
      'Maximum quantity must be unbounded or an integer at least equal to minimum quantity',
    );
}

export class PizzaComponentType {
  #id;
  #name;
  #assemblyOrder;
  #minQuantity;
  #maxQuantity;

  constructor(id, name, assemblyOrder, minQuantity, maxQuantity) {
    if (!id || typeof id.getValue !== 'function')
      throw new AppError('Component type ID is required');
    if (!name || typeof name.getValue !== 'function')
      throw new AppError('Component type name is required');
    validateConfiguration(assemblyOrder, minQuantity, maxQuantity);
    this.#id = id;
    this.#name = name;
    this.#assemblyOrder = assemblyOrder;
    this.#minQuantity = minQuantity;
    this.#maxQuantity = maxQuantity;
    Object.freeze(this);
  }

  static create(id, name, assemblyOrder, minQuantity, maxQuantity) {
    return new PizzaComponentType(
      id,
      name,
      assemblyOrder,
      minQuantity,
      maxQuantity,
    );
  }

  revised(name, assemblyOrder, minQuantity, maxQuantity) {
    return new PizzaComponentType(
      this.#id,
      name,
      assemblyOrder,
      minQuantity,
      maxQuantity,
    );
  }

  getId() {
    return this.#id;
  }

  getName() {
    return this.#name;
  }

  getAssemblyOrder() {
    return this.#assemblyOrder;
  }

  getMinQuantity() {
    return this.#minQuantity;
  }

  getMaxQuantity() {
    return this.#maxQuantity;
  }
}
