import { AppError } from '../../../../shared/errors/AppError.js';
import { CategoryId } from '../../domain/model/CategoryId.js';
import { CategoryName } from '../../domain/model/CategoryName.js';
import { ProductCategoryMapper } from '../mapping/ProductCategoryMapper.js';

export const REFERENCED_MESSAGE =
  'Product category referenced by existing products cannot be removed';

const found = (category) => {
  if (!category) throw new AppError('Category not found', 404);
  return category;
};

// Optional search filters (BR4): trimmed text of at most 100 characters.
function filter(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 100)
    throw new AppError(`Invalid ${field} filter`, 400);
  return value.trim() || undefined;
}

/**
 * Application service. Authentication and the MANAGER role are enforced by the
 * route middlewares (see the BCK03 sequence diagrams); business rules live here
 * and in the domain model.
 */
export class ProductCategoryService {
  constructor(categoryRepository, categoryMapper = ProductCategoryMapper) {
    Object.assign(this, { categoryRepository, categoryMapper });
  }

  async createCategory(dto) {
    const name = CategoryName.create(dto.name);
    if (await this.categoryRepository.existsByName(name))
      throw new AppError('Category name already exists', 409);
    const category = this.categoryMapper.toDomain(
      { name: name.getValue() },
      await this.categoryRepository.nextId(),
    );
    return this.categoryMapper.toDTO(
      await this.categoryRepository.save(category),
    );
  }

  async updateCategory(id, dto) {
    const categoryId = CategoryId.create(id);
    const name = CategoryName.create(dto.name);
    const category = found(await this.categoryRepository.findById(categoryId));
    const sameName = await this.categoryRepository.findByName(name);
    // Renaming a category to a different capitalisation of its own name is allowed.
    if (sameName && !sameName.getId().equals(categoryId))
      throw new AppError('Category name already exists', 409);
    category.updateName(name);
    return this.categoryMapper.toDTO(
      await this.categoryRepository.save(category),
    );
  }

  async listCategories({ name, id } = {}) {
    return this.categoryMapper.toDTOList(
      await this.categoryRepository.findAll({
        name: filter(name, 'name'),
        id: filter(id, 'id'),
      }),
    );
  }

  async getCategoryById(id) {
    return this.categoryMapper.toDTO(
      found(await this.categoryRepository.findById(CategoryId.create(id))),
    );
  }

  async deleteCategory(id) {
    const categoryId = CategoryId.create(id);
    found(await this.categoryRepository.findById(categoryId));
    // AC5 / BR3: application-level check; the FOREIGN KEY ... ON DELETE RESTRICT
    // declared by BCK05 remains the final defence under concurrency (BR5).
    if (await this.categoryRepository.isReferencedByProducts(categoryId))
      throw new AppError(REFERENCED_MESSAGE, 409);
    await this.categoryRepository.delete(categoryId);
  }
}
