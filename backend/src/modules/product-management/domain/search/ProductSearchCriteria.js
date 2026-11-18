import { AppError } from '../../../../shared/errors/AppError.js';
import { AllergenId } from '../../../allergen-management/domain/model/AllergenId.js';
import { CategoryId } from '../../../product-category-management/domain/model/CategoryId.js';
import { ComponentTypeId } from '../../../pizza-component-type-management/domain/model/values.js';
import { AcquisitionType } from '../model/AcquisitionType.js';

const MAX_NAME_FILTER = 100;
const FLAGS = ['isSellable', 'isPizzaComponent', 'isActive'];

/**
 * Validated search filters (BR8). Every field is optional; omitted fields do not
 * restrict the result. `excludeAllergenIds` removes products containing ANY of the
 * given allergens (client clarification Q9).
 */
export class ProductSearchCriteria {
  constructor({
    name,
    categoryId,
    isSellable,
    isPizzaComponent,
    isActive,
    acquisitionType,
    pizzaComponentTypeId,
    excludeAllergenIds = [],
  } = {}) {
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length > MAX_NAME_FILTER)
        throw new AppError('Invalid name filter');
      this.name = name.trim() || undefined;
    }
    if (categoryId !== undefined && !(categoryId instanceof CategoryId))
      throw new AppError('Invalid category filter');
    if (
      pizzaComponentTypeId !== undefined &&
      !(pizzaComponentTypeId instanceof ComponentTypeId)
    )
      throw new AppError('Invalid pizza component type filter');
    const flags = { isSellable, isPizzaComponent, isActive };
    for (const flag of FLAGS) {
      if (flags[flag] !== undefined && typeof flags[flag] !== 'boolean')
        throw new AppError(`Invalid ${flag} filter`);
    }
    if (
      !Array.isArray(excludeAllergenIds) ||
      !excludeAllergenIds.every((id) => id instanceof AllergenId)
    )
      throw new AppError('Invalid excludeAllergenIds filter');
    Object.assign(this, {
      categoryId,
      pizzaComponentTypeId,
      ...flags,
      acquisitionType:
        acquisitionType === undefined
          ? undefined
          : AcquisitionType.from(acquisitionType),
      excludeAllergenIds: [
        ...new Map(excludeAllergenIds.map((id) => [id.getValue(), id])).values(),
      ],
    });
    Object.freeze(this);
  }
}
