import { AppError } from '../../../../shared/errors/AppError.js';
import { ComponentConfigurationData } from '../dtos/ComponentConfigurationData.js';
import { ComponentConfigurationResponseMapper } from '../mapping/ComponentConfigurationResponseMapper.js';
import { ComponentSizeConfiguration } from '../../domain/model/ComponentSizeConfiguration.js';
import { Money } from '../../domain/model/values.js';

export class ComponentSizeConfigurationService {
  constructor({ repository, products, sizes, unitOfWork, impact }) {
    Object.assign(this, { repository, products, sizes, unitOfWork, impact });
  }

  async create(productId, sizeId, data) {
    const input =
      data instanceof ComponentConfigurationData
        ? data
        : new ComponentConfigurationData(data);
    return this.unitOfWork.withTransaction(async (tx) => {
      const product = await this.products.findByIdForUpdate(productId, tx);
      if (!product) throw new AppError('Product not found', 404);
      const size = await this.sizes.findByIdForUpdate(sizeId, tx);
      if (!size) throw new AppError('Pizza size not found', 404);
      const existing = await this.repository.findByPair(productId, sizeId, tx);
      if (existing)
        throw new AppError(
          'A component configuration already exists for this product and size',
          409,
        );
      const candidate = ComponentSizeConfiguration.create(
        product,
        size,
        Money.create(input.amount, input.currency),
        input.stockUnitsConsumed,
      );
      await this.impact.assertSafeChange(null, candidate, tx);
      await this.repository.insert(candidate, tx);
      return ComponentConfigurationResponseMapper.toDTO(candidate);
    });
  }

  async update(productId, sizeId, changes) {
    const input =
      changes instanceof ComponentConfigurationData ? changes : { ...changes };
    return this.unitOfWork.withTransaction(async (tx) => {
      const product = await this.products.findByIdForUpdate(productId, tx);
      if (!product) throw new AppError('Product not found', 404);
      const size = await this.sizes.findByIdForUpdate(sizeId, tx);
      if (!size) throw new AppError('Pizza size not found', 404);
      const current = await this.repository.findByPairForUpdate(
        productId,
        sizeId,
        tx,
      );
      if (!current)
        throw new AppError('Component configuration not found', 404);
      const merged = this.mergeChanges(current, input);
      const price = Money.create(merged.amount, merged.currency);
      const candidate = current.revised(
        product,
        price,
        merged.stockUnitsConsumed,
      );
      await this.impact.assertSafeChange(current, candidate, tx);
      await this.repository.save(candidate, tx);
      return ComponentConfigurationResponseMapper.toDTO(candidate);
    });
  }

  mergeChanges(current, changes) {
    return new ComponentConfigurationData({
      amount: Object.hasOwn(changes, 'amount')
        ? changes.amount
        : current.getPrice().getAmount(),
      currency: Object.hasOwn(changes, 'currency')
        ? changes.currency
        : current.getPrice().getCurrency(),
      stockUnitsConsumed: Object.hasOwn(changes, 'stockUnitsConsumed')
        ? changes.stockUnitsConsumed
        : (current.getStockUnitsConsumed()?.getUnits() ?? null),
    });
  }

  async consult(productId) {
    const product = await this.products.findById(productId);
    if (!product) throw new AppError('Product not found', 404);
    const configurations = await this.repository.findByProduct(productId);
    return configurations.map((configuration) =>
      ComponentConfigurationResponseMapper.toDTO(configuration),
    );
  }
}
