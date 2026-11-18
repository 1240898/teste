import { AppError } from '../../../../shared/errors/AppError.js';
import { AllergenId } from '../../domain/model/AllergenId.js';
import { AllergenName } from '../../domain/model/AllergenName.js';
import { AllergenMapper } from '../mapping/AllergenMapper.js';

export const NAME_CONFLICT_MESSAGE = 'Allergen name already exists';
export const ID_CONFLICT_MESSAGE = 'Allergen id already exists';
export const REFERENCED_MESSAGE =
  'Allergen referenced by existing business information cannot be removed';

const found = (allergen) => {
  if (!allergen) throw new AppError('Allergen not found', 404);
  return allergen;
};

// Optional search filters (BR4): text of at most 100 characters; blank means "no filter".
function text(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 100)
    throw new AppError(`Invalid ${field} filter`, 400);
  return value.trim() || undefined;
}

/**
 * Application service. Authentication and the MANAGER role are enforced by the
 * route middlewares (see the BCK04 sequence diagrams); business rules live here
 * and in the domain model.
 */
export class AllergenService {
  constructor(allergenRepository, allergenMapper = AllergenMapper) {
    Object.assign(this, { allergenRepository, allergenMapper });
  }

  async createAllergen(dto) {
    // Value objects first: invalid input is a 400 and never reaches persistence.
    const id = AllergenId.create(dto.id);
    const name = AllergenName.create(dto.name);
    if (await this.allergenRepository.existsByName(name))
      throw new AppError(NAME_CONFLICT_MESSAGE, 409);
    if (await this.allergenRepository.findById(id))
      throw new AppError(ID_CONFLICT_MESSAGE, 409);
    const allergen = this.allergenMapper.toDomain({
      id: id.getValue(),
      name: name.getValue(),
    });
    return this.allergenMapper.toDTO(
      await this.allergenRepository.save(allergen),
    );
  }

  async updateAllergen(id, dto) {
    const allergenId = AllergenId.create(id);
    const name = AllergenName.create(dto.name);
    const allergen = found(await this.allergenRepository.findById(allergenId));
    const sameName = await this.allergenRepository.findByName(name);
    // Changing only the capitalisation of its own name is allowed.
    if (sameName && !sameName.getId().equals(allergenId))
      throw new AppError(NAME_CONFLICT_MESSAGE, 409);
    allergen.updateName(name);
    return this.allergenMapper.toDTO(
      await this.allergenRepository.save(allergen),
    );
  }

  async listAllergens({ name, id } = {}) {
    const idFilter = text(id, 'id');
    let allergenId;
    if (idFilter !== undefined) {
      try {
        allergenId = AllergenId.create(idFilter);
      } catch {
        throw new AppError('Invalid id filter', 400);
      }
    }
    return this.allergenMapper.toDTOList(
      await this.allergenRepository.findAll({
        name: text(name, 'name'),
        id: allergenId,
      }),
    );
  }

  async getAllergenById(id) {
    return this.allergenMapper.toDTO(
      found(await this.allergenRepository.findById(AllergenId.create(id))),
    );
  }

  async deleteAllergen(id) {
    const allergenId = AllergenId.create(id);
    found(await this.allergenRepository.findById(allergenId));
    // AC6 / BR3: application-level check; FOREIGN KEY ... ON DELETE RESTRICT on the
    // referencing tables remains the final defence under concurrency (BR5).
    if (await this.allergenRepository.isReferenced(allergenId))
      throw new AppError(REFERENCED_MESSAGE, 409);
    await this.allergenRepository.delete(allergenId);
  }
}