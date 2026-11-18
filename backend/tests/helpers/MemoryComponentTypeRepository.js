import { AppError } from '../../src/shared/errors/AppError.js';

export class MemoryComponentTypeRepository {
  types = new Map();
  #nextIdValue = 1;

  #values(tx) {
    return tx?.types ?? this.types;
  }

  async findById(id) {
    return this.types.get(id.getValue()) ?? null;
  }

  async nextId(tx) {
    const types = this.#values(tx);
    let id;
    do {
      id = `type-${String(this.#nextIdValue++).padStart(2, '0')}`;
    } while (types.has(id));
    return id;
  }

  async search(criteria) {
    const types = [...this.types.values()];
    if (!criteria.id && criteria.name === undefined) return types;
    return types.filter(
      (type) =>
        (criteria.id && type.getId().equals(criteria.id)) ||
        (criteria.name !== undefined &&
          type.getName().getValue().toLocaleLowerCase('en-US') ===
            criteria.name.toLocaleLowerCase('en-US')),
    );
  }

  async findByIdForUpdate(id, tx) {
    return this.#values(tx).get(id.getValue()) ?? null;
  }

  async existsByOrder(order, excludingId, tx) {
    return [...this.#values(tx).values()].some(
      (type) =>
        type.getAssemblyOrder() === order &&
        type.getId().getValue() !== excludingId?.getValue(),
    );
  }

  async insert(type, tx) {
    const types = this.#values(tx);
    const duplicate = [...types.values()].some(
      (saved) =>
        saved.getName().getValue().toLocaleLowerCase('en-US') ===
        type.getName().getValue().toLocaleLowerCase('en-US'),
    );
    if (duplicate)
      throw new AppError('Component type name already exists', 409);
    types.set(type.getId().getValue(), type);
  }

  async save(type, tx) {
    const types = this.#values(tx);
    const duplicate = [...types.values()].some(
      (saved) =>
        saved.getId().getValue() !== type.getId().getValue() &&
        saved.getName().getValue().toLocaleLowerCase('en-US') ===
          type.getName().getValue().toLocaleLowerCase('en-US'),
    );
    if (duplicate)
      throw new AppError('Component type name already exists', 409);
    types.set(type.getId().getValue(), type);
  }

  async delete(id, tx) {
    this.#values(tx).delete(id.getValue());
  }
}

export class MemoryComponentTypeUnitOfWork {
  constructor(repository) {
    this.repository = repository;
  }

  async withTransaction(work) {
    const types = new Map(this.repository.types);
    const result = await work({ types });
    this.repository.types = types;
    return result;
  }
}
