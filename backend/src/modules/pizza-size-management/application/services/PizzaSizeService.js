import { AppError } from '../../../../shared/errors/AppError.js';
import { PizzaSize } from '../../domain/model/PizzaSize.js';
import {
  PizzaSizeId,
  PizzaSizeName,
  PizzaSizeSearchCriteria,
} from '../../domain/model/values.js';
import { PizzaSizeResponseMapper } from '../mapping/PizzaSizeResponseMapper.js';

const found = (pizzaSize) => {
  if (!pizzaSize) throw new AppError('Pizza size not found', 404);
  return pizzaSize;
};

export class PizzaSizeService {
  constructor(repository) {
    this.repository = repository;
  }
  async create(dto) {
    const name = PizzaSizeName.create(dto.name);
    if (await this.repository.findByName(name.getValue()))
      throw new AppError('Pizza size name already exists', 409);
    const pizzaSize = PizzaSize.create(
      PizzaSizeId.create(await this.repository.nextId()),
      name,
    );
    return PizzaSizeResponseMapper.toDTO(await this.repository.save(pizzaSize));
  }
  async update(id, dto) {
    const pizzaSize = found(
      await this.repository.findById(PizzaSizeId.create(id)),
    );
    if (dto.name !== undefined) {
      const name = PizzaSizeName.create(dto.name);
      const other = await this.repository.findByName(name.getValue());
      if (other && other.id.getValue() !== pizzaSize.id.getValue())
        throw new AppError('Pizza size name already exists', 409);
      pizzaSize.updateName(name);
    }
    if (dto.active !== undefined) {
      if (dto.active) pizzaSize.activate();
      else pizzaSize.deactivate();
    }
    return PizzaSizeResponseMapper.toDTO(await this.repository.save(pizzaSize));
  }
  async getById(id) {
    return PizzaSizeResponseMapper.toDTO(
      found(await this.repository.findById(PizzaSizeId.create(id))),
    );
  }
  async search(criteria) {
    return PizzaSizeResponseMapper.toDTOList(
      await this.repository.search(
        PizzaSizeSearchCriteria.create(criteria).getValue(),
      ),
    );
  }
  async delete(id) {
    const pizzaSize = found(
      await this.repository.findById(PizzaSizeId.create(id)),
    );
    if (await this.repository.isReferencedByOtherEntities(pizzaSize.id))
      throw new AppError('Pizza size is referenced and cannot be deleted', 409);
    await this.repository.delete(pizzaSize.id);
  }
}
