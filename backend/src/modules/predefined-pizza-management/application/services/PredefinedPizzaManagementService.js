import { AppError } from '../../../../shared/errors/AppError.js';
import { ProductId } from '../../../product-management/domain/model/ProductId.js';
import { ProductCompositionItem } from '../../../product-management/domain/model/ProductCompositionItem.js';
import { PredefinedPizzaResponseMapper } from '../mapping/PredefinedPizzaResponseMapper.js';

const found = (pizza) => {
  if (!pizza) throw new AppError('Predefined Pizza not found', 404);
  return pizza;
};

export class PredefinedPizzaManagementService {
  constructor({
    productRepository,
    referenceReader,
    unitOfWork,
    responseMapper = PredefinedPizzaResponseMapper,
  }) {
    if (
      !productRepository ||
      !referenceReader ||
      !unitOfWork ||
      !responseMapper
    )
      throw new TypeError(
        'BCK10 repository, reader and unit of work are required',
      );
    Object.assign(this, {
      productRepository,
      referenceReader,
      unitOfWork,
      responseMapper,
    });
  }

  async create(dto) {
    if (!dto || typeof dto !== 'object')
      throw new AppError('Invalid predefined pizza data');
    const productId = this.#productId(dto.productId);
    const componentIds = this.#componentIds(dto.componentIds);
    this.#assertNoSelfReference(productId, componentIds);

    return this.unitOfWork.withTransaction(async (tx) => {
      const pizza = found(
        await this.productRepository.findByIdForUpdate(productId, tx),
      );
      this.#assertPredefinedPizza(pizza);
      if (pizza.getCompositionItems().length > 0)
        throw new AppError(
          'Predefined Pizza default composition already exists',
          409,
        );
      const facts = await this.referenceReader.readFacts(
        productId.getValue(),
        componentIds,
        tx,
      );
      this.#validate(pizza, componentIds, facts);
      pizza.replaceComposition(
        componentIds.map((id) =>
          ProductCompositionItem.create(ProductId.create(id), 1),
        ),
      );
      await this.productRepository.save(pizza, tx);
      return this.responseMapper.toDTO(pizza);
    });
  }

  async list() {
    const pizzas = await this.productRepository.listPredefinedPizzas();
    return pizzas.map((pizza) => this.responseMapper.toDTO(pizza));
  }

  async getById(id) {
    const pizzaId = this.#productId(id);
    return this.responseMapper.toDTO(
      this.#requirePizza(found(await this.productRepository.findById(pizzaId))),
    );
  }

  async replaceConfiguration(id, dto) {
    if (!dto || typeof dto !== 'object')
      throw new AppError('Invalid pizza configuration data');
    const pizzaId = this.#productId(id);
    const componentIds = this.#componentIds(dto.componentIds);
    this.#assertNoSelfReference(pizzaId, componentIds);

    return this.unitOfWork.withTransaction(async (tx) => {
      const pizza = this.#requirePizza(
        found(await this.productRepository.findByIdForUpdate(pizzaId, tx)),
      );
      const facts = await this.referenceReader.readFacts(
        pizzaId.getValue(),
        componentIds,
        tx,
      );
      this.#validate(pizza, componentIds, facts);
      pizza.replaceComposition(
        componentIds.map((id) =>
          ProductCompositionItem.create(ProductId.create(id), 1),
        ),
      );
      const updated = await this.productRepository.save(pizza, tx);
      return this.responseMapper.toDTO(updated);
    });
  }

  #requirePizza(product) {
    this.#assertPredefinedPizza(product);
    if (product.getCompositionItems().length === 0)
      throw new AppError('Predefined Pizza not found', 404);
    return product;
  }

  #productId(value) {
    return value instanceof ProductId ? value : ProductId.create(value);
  }

  #componentIds(value) {
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.some(
        (id) => typeof id !== 'string' || !/^PROD-[0-9]{5,}$/.test(id),
      ) ||
      new Set(value).size !== value.length
    )
      throw new AppError('Invalid or repeated component Product IDs');
    return [...value];
  }

  #assertNoSelfReference(productId, componentIds) {
    if (componentIds.includes(productId.getValue()))
      throw new AppError(
        'A Predefined Pizza cannot include itself as a component',
        409,
      );
  }

  #assertPredefinedPizza(product) {
    if (
      !product.isSellable() ||
      product.isPizzaComponent() ||
      product.getPricingMode() !== 'COMPONENT_BASED'
    )
      throw new AppError(
        'Product must be a component-based Sellable Product and not a Pizza Component',
        409,
      );
  }

  #validate(pizza, componentIds, facts) {
    const representative = facts.representativeProduct;
    if (
      representative.productId !== pizza.getId().getValue() ||
      !representative.isSellable ||
      representative.isPizzaComponent
    )
      throw new AppError('Invalid Predefined Pizza Product', 409);
    const components = new Map(
      facts.components.map((component) => [component.productId, component]),
    );
    const counts = new Map();
    for (const id of componentIds) {
      const component = components.get(id);
      if (!component) throw new AppError('Pizza component not found', 404);
      if (!component.isActive || !component.isPizzaComponent)
        throw new AppError(
          'Pizza components must be active and designated as Pizza Components',
          409,
        );
      counts.set(
        component.componentTypeId,
        (counts.get(component.componentTypeId) ?? 0) + 1,
      );
    }
    const rules = new Map(
      facts.typeRules.map((rule) => [rule.componentTypeId, rule]),
    );
    for (const component of components.values())
      if (!rules.has(component.componentTypeId))
        throw new AppError('Pizza component type not found', 404);
    for (const rule of facts.typeRules) {
      const count = counts.get(rule.componentTypeId) ?? 0;
      if (
        count < rule.minQuantity ||
        (rule.maxQuantity !== null && count > rule.maxQuantity)
      )
        throw new AppError(
          'The default configuration violates a Pizza Component Type limit',
          409,
        );
    }
    if (facts.activeStructurallyEligibleSizes.length === 0)
      throw new AppError(
        'No active Pizza Size has complete component configuration coverage',
        409,
      );
  }
}
