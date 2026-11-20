import { AppError } from '../../../../shared/errors/AppError.js';
import { AllergenId } from '../../../allergen-management/domain/model/AllergenId.js';
import { CategoryId } from '../../../product-category-management/domain/model/CategoryId.js';
import { ComponentTypeId } from '../../../pizza-component-type-management/domain/model/values.js';
import { Product } from '../../domain/model/Product.js';
import { ProductId } from '../../domain/model/ProductId.js';
import { ProductSearchCriteria } from '../../domain/search/ProductSearchCriteria.js';
import { ProductMapper } from '../mapping/ProductMapper.js';

export const PRODUCT_NOT_FOUND = 'Product not found';

const found = (product) => {
  if (!product) throw new AppError(PRODUCT_NOT_FOUND, 404);
  return product;
};

// Query-string flag: "true"/"false" (or an already-parsed boolean).
function flag(value, field) {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new AppError(`Invalid ${field} filter`);
}

// "1,7" | [1, 7] | ["1", "7"] -> AllergenId[]
function allergenList(value) {
  if (value === undefined || value === '') return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  try {
    return items.map((item) => AllergenId.create(item));
  } catch {
    throw new AppError('Invalid excludeAllergenIds filter');
  }
}

// Filters a public (unauthenticated / non-staff) caller may use. Internal
// fields such as acquisitionType, isPizzaComponent or pizzaComponentTypeId
// are not in the public DTO, so filtering by them would reveal them.
const PUBLIC_FILTER_KEYS = ['name', 'categoryId', 'excludeAllergenIds'];

const publicFilter = (filter) =>
  Object.fromEntries(
    PUBLIC_FILTER_KEYS.filter((key) => filter[key] !== undefined).map(
      (key) => [key, filter[key]],
    ),
  );


/**
 * Application service of BCK05. Authentication and roles are enforced by the route
 * middlewares; local invariants live in the Product aggregate; this service checks
 * references and cross-story impact, and owns the transaction.
 */
export class ProductService {
  /**
   * @param {Object} deps
   * @param {import('../../domain/repositories/IProductRepository.js').IProductRepository} deps.productRepository
   * @param {import('../ports/IProductReferenceReader.js').IProductReferenceReader} deps.referenceReader
   * @param {import('../ports/IProductImpactChecker.js').IProductImpactChecker} deps.impactChecker
   * @param {import('../ports/IUnitOfWork.js').IUnitOfWork} deps.unitOfWork
   */
  constructor({
    productRepository,
    referenceReader,
    impactChecker,
    unitOfWork,
    productMapper = ProductMapper,
  }) {
    Object.assign(this, {
      productRepository,
      referenceReader,
      impactChecker,
      unitOfWork,
      productMapper,
    });
  }

  /** SD1 - Create Product (AC1-AC7, D2, D5). */
  async createProduct(dto) {
    const props = this.#validatedProps(dto);
    const saved = await this.unitOfWork.withTransaction(async (tx) => {
      await this.#ensureReferencesExist(props, tx);
      const product = Product.create(
        await this.productRepository.nextId(tx),
        props,
      );
      await this.#ensureCompositionIsValid(product.getId(), props, tx);
      return this.productRepository.save(product, tx);
    });
    return this.productMapper.toDTO(saved);
  }

  /** SD2 - Update Product (AC1, AC10, BR10.1, BR11, D2, D3, D5). */
  async updateProduct(id, dto) {
    const productId = ProductId.create(id);
    const props = this.#validatedProps(dto);
    const saved = await this.unitOfWork.withTransaction(async (tx) => {
      // Lock order: Product row first (same order as BCK09 stock adjustments).
      const product = found(
        await this.productRepository.findByIdForUpdate(productId, tx),
      );
      if (
        typeof dto.expectedUpdatedAt !== 'string' ||
        new Date(dto.expectedUpdatedAt).getTime() !== product.updatedAt.getTime()
      )
        throw new AppError(
          'Product changed since it was loaded. Reload and review the current version before saving.',
          412,
        );
      await this.#ensureReferencesExist(props, tx);
      await this.#ensureCompositionIsValid(productId, props, tx);
      await this.#ensureNoBrokenReferences(product, props, tx);
      product.revise(props);
      return this.productRepository.save(product, tx);
    });
    return this.productMapper.toDTO(saved);
  }

  /** SD4 - Search products (AC8, BR8). */
  async listProducts(filter = {}) {
    const criteria = this.#toSearchCriteria(filter);
    return this.productMapper.toDTOList(
      await this.productRepository.search(criteria),
    );
  }

    /** Public catalogue data contains active sellable products only. */
  async listPublicProducts(filter = {}) {
    const criteria = this.#toSearchCriteria({
      ...publicFilter(filter),
      isSellable: true,
      isActive: true,
    });
    return this.productMapper.toPublicDTOList(
      await this.productRepository.search(criteria),
    );
  }

  /** SD4 - Consult one product. */
  async getProductById(id) {
    return this.productMapper.toDTO(
      found(await this.productRepository.findById(ProductId.create(id))),
    );
  }

  async getPublicProductById(id) {
    const product = found(
      await this.productRepository.findById(ProductId.create(id)),
    );
    if (!product.isSellable() || !product.isActive())
      throw new AppError(PRODUCT_NOT_FOUND, 404);
    return this.productMapper.toPublicDTO(product);
  }

  /** SD3 - Soft deactivation (AC9, BR9, D6). Never calls BCK09. */
  async deactivateProduct(id) {
    const productId = ProductId.create(id);
    await this.unitOfWork.withTransaction(async (tx) => {
      const product = found(
        await this.productRepository.findByIdForUpdate(productId, tx),
      );
      product.deactivate();
      await this.productRepository.save(product, tx);
    });
  }

  /** SD3 - Reactivation. Never calls BCK09. */
  async activateProduct(id) {
    const productId = ProductId.create(id);
    const saved = await this.unitOfWork.withTransaction(async (tx) => {
      const product = found(
        await this.productRepository.findByIdForUpdate(productId, tx),
      );
      product.activate();
      return this.productRepository.save(product, tx);
    });
    return this.productMapper.toDTO(saved);
  }

  // Value objects + domain invariants, BEFORE any database access (400).
  #validatedProps(dto) {
    if (!dto || typeof dto !== 'object')
      throw new AppError('Invalid product data');
    const props = this.productMapper.toProps(dto);
    Product.validateProps(props);
    return props;
  }

  async #ensureReferencesExist(props, tx) {
    if (!(await this.referenceReader.categoryExists(props.categoryId, tx)))
      throw new AppError('Product category not found', 404);
    if (
      props.pizzaComponentTypeId &&
      !(await this.referenceReader.componentTypeExists(
        props.pizzaComponentTypeId,
        tx,
      ))
    )
      throw new AppError('Pizza component type not found', 404);
    if (props.allergenIds.length) {
      const missing = await this.referenceReader.findMissingAllergens(
        props.allergenIds,
        tx,
      );
      if (missing.length)
        throw new AppError(
          `Allergen not found: ${missing.map((a) => a.getValue()).join(', ')}`,
          404,
        );
    }
    if (props.compositionItems.length) {
      const missing = await this.referenceReader.findMissingCompositionProducts(
        props.compositionItems.map((item) => item.getProductId()),
        tx,
      );
      if (missing.length)
        throw new AppError(`Composition product not found: ${missing.join(', ')}`, 404);
      const invalid = await this.referenceReader.findUnclassifiedCompositionProducts(
        props.compositionItems.map((item) => item.getProductId()),
        tx,
      );
      if (invalid.length)
        throw new AppError(`Composition product is not a product type: ${invalid.join(', ')}`);
    }
  }

  async #ensureCompositionIsValid(productId, props, tx) {
    if (
      await this.referenceReader.compositionWouldCreateCycle(
        productId,
        props.compositionItems.map((item) => item.getProductId()),
        tx,
      )
    )
      throw new AppError('Product composition cannot contain cycles', 409);
  }

  // BR10.1: changes that would invalidate BCK08/BCK10 references are rejected (409).
  async #ensureNoBrokenReferences(current, props, tx) {
    const id = current.getId();
    if (current.isPizzaComponent()) {
      if (!props.isPizzaComponent)
        await this.impactChecker.assertComponentRoleRemovable(id, tx);
      else if (
        !current.getPizzaComponentTypeId().equals(props.pizzaComponentTypeId)
      )
        await this.impactChecker.assertComponentTypeChangeAllowed(
          id,
          props.pizzaComponentTypeId,
          tx,
        );
    }
    if (current.getPricingMode() !== props.pricingMode)
      await this.impactChecker.assertPricingModeChangeAllowed(
        id,
        props.pricingMode,
        tx,
      );
  }

  #toSearchCriteria(filter) {
    return new ProductSearchCriteria({
      name: filter.name,
      categoryId:
        filter.categoryId === undefined
          ? undefined
          : CategoryId.create(filter.categoryId),
      isSellable: flag(filter.isSellable, 'isSellable'),
      isPizzaComponent: flag(filter.isPizzaComponent, 'isPizzaComponent'),
      acquisitionType:
        filter.acquisitionType === undefined
          ? undefined
          : filter.acquisitionType,
      isActive: flag(filter.isActive, 'isActive'),
      pizzaComponentTypeId:
        filter.pizzaComponentTypeId === undefined
          ? undefined
          : ComponentTypeId.create(filter.pizzaComponentTypeId),
      excludeAllergenIds: allergenList(filter.excludeAllergenIds),
    });
  }
}
