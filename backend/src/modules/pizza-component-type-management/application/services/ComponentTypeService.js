import { AppError } from '../../../../shared/errors/AppError.js';
import { ComponentTypeData } from '../dtos/ComponentTypeData.js';
import { ComponentTypeResponseMapper } from '../mapping/ComponentTypeResponseMapper.js';
import { ComponentTypeSearchCriteria } from '../../domain/model/ComponentTypeSearchCriteria.js';
import { PizzaComponentType } from '../../domain/model/PizzaComponentType.js';
import {
  ComponentTypeId,
  ComponentTypeName,
} from '../../domain/model/values.js';

export class ComponentTypeService {
  constructor(repository, unitOfWork, impact) {
    Object.assign(this, { repository, unitOfWork, impact });
  }

  toSearchCriteria(query) {
    return new ComponentTypeSearchCriteria({
      id: query.id === undefined ? undefined : ComponentTypeId.create(query.id),
      name: query.name,
    });
  }

  mergeChanges(current, changes) {
    return new ComponentTypeData({
      name: Object.hasOwn(changes, 'name')
        ? changes.name
        : current.getName().getValue(),
      assemblyOrder: Object.hasOwn(changes, 'assemblyOrder')
        ? changes.assemblyOrder
        : current.getAssemblyOrder(),
      minQuantity: Object.hasOwn(changes, 'minQuantity')
        ? changes.minQuantity
        : current.getMinQuantity(),
      maxQuantity: Object.hasOwn(changes, 'maxQuantity')
        ? changes.maxQuantity
        : current.getMaxQuantity(),
    });
  }

  async create(dto) {
    const data =
      dto instanceof ComponentTypeData ? dto : new ComponentTypeData(dto);
    return this.unitOfWork.withTransaction(async (tx) => {
      const id = ComponentTypeId.create(await this.repository.nextId(tx));
      const name = ComponentTypeName.create(data.name);
      const candidate = PizzaComponentType.create(
        id,
        name,
        data.assemblyOrder,
        data.minQuantity,
        data.maxQuantity,
      );
      if (await this.repository.existsByOrder(data.assemblyOrder, null, tx))
        throw new AppError('Assembly order already exists', 409);
      await this.impact.assertSafeCreate(candidate, tx);
      await this.repository.insert(candidate, tx);
      return ComponentTypeResponseMapper.toDTO(candidate);
    });
  }

  async getById(id) {
    const type = await this.repository.findById(id);
    if (!type) throw new AppError('Pizza component type not found', 404);
    return ComponentTypeResponseMapper.toDTO(type);
  }

  async search(query) {
    const criteria = this.toSearchCriteria(query);
    const types = await this.repository.search(criteria);
    return types.map((type) => ComponentTypeResponseMapper.toDTO(type));
  }

  async update(id, changes) {
    return this.unitOfWork.withTransaction(async (tx) => {
      const current = await this.repository.findByIdForUpdate(id, tx);
      if (!current) throw new AppError('Pizza component type not found', 404);
      const merged = this.mergeChanges(current, changes);
      const candidate = current.revised(
        ComponentTypeName.create(merged.name),
        merged.assemblyOrder,
        merged.minQuantity,
        merged.maxQuantity,
      );
      if (
        await this.repository.existsByOrder(
          candidate.getAssemblyOrder(),
          id,
          tx,
        )
      )
        throw new AppError('Assembly order already exists', 409);
      await this.impact.assertSafeUpdate(current, candidate, tx);
      await this.repository.save(candidate, tx);
      return ComponentTypeResponseMapper.toDTO(candidate);
    });
  }

  async remove(id) {
    return this.unitOfWork.withTransaction(async (tx) => {
      const current = await this.repository.findByIdForUpdate(id, tx);
      if (!current) throw new AppError('Pizza component type not found', 404);
      await this.impact.assertSafeRemoval(current, tx);
      await this.repository.delete(id, tx);
    });
  }
}
