import { AppError } from '../../src/shared/errors/AppError.js';
import { AllergenId } from '../../src/modules/allergen-management/domain/model/AllergenId.js';
import { ProductId } from '../../src/modules/product-management/domain/model/ProductId.js';
import { ProductRowMapper } from '../../src/modules/product-management/infrastructure/persistence/ProductRowMapper.js';

const asDatabaseRow = (row) => ({
  ...row,
  composition_items: (row.composition_items ?? []).map((item) => ({
    productId: item.productId ?? item.product_id,
    quantity: Number(item.quantity),
  })),
});

/** In-memory adapter honouring the BCK05 repository contract. */
export class MemoryProductRepository {
  rows = new Map();
  #sequence = 0;

  async nextId() {
    return ProductId.create(`PROD-${String(++this.#sequence).padStart(5, '0')}`);
  }
  async findById(id) {
    const row = this.rows.get(id.getValue());
    return row ? ProductRowMapper.toDomain(asDatabaseRow(row)) : null;
  }
  async findByIdForUpdate(id, tx) {
    if (!tx) throw new TypeError('findByIdForUpdate requires a transaction');
    return this.findById(id);
  }
  async search(criteria) {
    const excluded = new Set(criteria.excludeAllergenIds.map((item) => item.getValue()));
    return [...this.rows.values()]
      .filter((row) => !criteria.name || row.name.toLowerCase().includes(criteria.name.toLowerCase()))
      .filter((row) => !criteria.categoryId || row.category_id === criteria.categoryId.getValue())
      .filter((row) => !criteria.pizzaComponentTypeId || row.pizza_component_type_id === criteria.pizzaComponentTypeId.getValue())
      .filter((row) => [
        ['isSellable', 'is_sellable'],
        ['isPizzaComponent', 'is_pizza_component'],
        ['isActive', 'is_active'],
        ['acquisitionType', 'acquisition_type'],
      ].every(([field, column]) => criteria[field] === undefined || row[column] === criteria[field]))
      .filter((row) => !(row.allergen_ids ?? []).some((id) => excluded.has(id)))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id.localeCompare(b.id))
      .map((row) => ProductRowMapper.toDomain(asDatabaseRow(row)));
  }
  async save(product) {
    const row = ProductRowMapper.toPersistence(product);
    this.rows.set(row.id, structuredClone(row));
    return ProductRowMapper.toDomain(asDatabaseRow(row));
  }
}

/** Unit of work with snapshot/rollback over the in-memory repository. */
export class MemoryUnitOfWork {
  transactions = 0;
  constructor(repository) {
    this.repository = repository;
  }
  async withTransaction(work) {
    const snapshot = structuredClone([...this.repository.rows]);
    const tx = { id: ++this.transactions };
    try {
      return await work(tx);
    } catch (error) {
      this.repository.rows = new Map(snapshot);
      throw error;
    }
  }
}

/** In-memory reference reader for BCK03, BCK04, BCK07 and existing products. */
export class MemoryProductReferenceReader {
  categories = new Set(['CAT-00001', 'CAT-00002']);
  componentTypes = new Set(['type-01', 'type-02', 'type-03', 'type-04']);
  allergens = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  productRepository;

  async categoryExists(id) {
    return this.categories.has(id.getValue());
  }
  async componentTypeExists(id) {
    return this.componentTypes.has(id.getValue());
  }
  async findMissingAllergens(ids) {
    return ids
      .filter((id) => !this.allergens.has(id.getValue()))
      .map((id) => AllergenId.create(id.getValue()));
  }
  async findMissingCompositionProducts(ids) {
    return ids
      .map((id) => id.getValue())
      .filter((id) => !this.productRepository?.rows.has(id));
  }
  async findUnclassifiedCompositionProducts(ids) {
    return ids
      .map((id) => id.getValue())
      .filter((id) => {
        const row = this.productRepository?.rows.get(id);
        return row && !row.is_sellable && !row.is_pizza_component;
      });
  }
  async compositionWouldCreateCycle(parentId, childIds) {
    const target = parentId.getValue();
    const reachesTarget = (id, visited = new Set()) => {
      if (id === target) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      const row = this.productRepository?.rows.get(id);
      return (row?.composition_items ?? []).some((item) =>
        reachesTarget(item.product_id ?? item.productId, visited),
      );
    };
    return childIds.some((id) => reachesTarget(id.getValue()));
  }
}

/** BCK08/BCK10 reference guard double. */
export class MemoryProductImpactChecker {
  components = new Set();
  predefinedPizzas = new Set();
  async assertComponentRoleRemovable(id) {
    if (this.components.has(id.getValue()))
      throw new AppError('Product is used as a pizza component', 409);
  }
  async assertComponentTypeChangeAllowed(id) {
    if (this.components.has(id.getValue()))
      throw new AppError('Product is used as a pizza component', 409);
  }
  async assertPricingModeChangeAllowed(id, newMode) {
    if (newMode !== 'COMPONENT_BASED' && this.predefinedPizzas.has(id.getValue()))
      throw new AppError('Product is used by a predefined pizza', 409);
  }
}
