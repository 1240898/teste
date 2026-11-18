import { jest } from '@jest/globals';
import { AppError } from '../../../src/shared/errors/AppError.js';
import { PredefinedPizzaManagementService } from '../../../src/modules/predefined-pizza-management/application/services/PredefinedPizzaManagementService.js';
import { Product } from '../../../src/modules/product-management/domain/model/Product.js';
import { ProductId } from '../../../src/modules/product-management/domain/model/ProductId.js';
import { AcquisitionType } from '../../../src/modules/product-management/domain/model/AcquisitionType.js';
import {
  ComponentEligibility,
  ConfigurationFacts,
  ProductEligibility,
  TypeCardinalityRule,
} from '../../../src/modules/predefined-pizza-management/domain/model/ConfigurationFacts.js';

const productId = 'PROD-00123';
const componentIds = ['PROD-00124', 'PROD-00125'];
const request = { productId, componentIds };
const makePizza = (id = productId) =>
  Product.restore({
    id,
    name: 'Classic Pizza',
    description: 'Classic pizza',
    categoryId: 'CAT-00001',
    isSellable: true,
    isPizzaComponent: false,
    acquisitionType: AcquisitionType.PRODUCED,
    isActive: true,
    pizzaComponentTypeId: null,
    allergenIds: [],
    pricingMode: 'COMPONENT_BASED',
    basePrice: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });

const facts = () =>
  new ConfigurationFacts({
    representativeProduct: new ProductEligibility({
      productId,
      isSellable: true,
      isPizzaComponent: false,
    }),
    components: componentIds.map(
      (id, index) =>
        new ComponentEligibility({
          productId: id,
          isActive: true,
          isPizzaComponent: true,
          componentTypeId: index ? 'type-04' : 'type-01',
        }),
    ),
    typeRules: [
      new TypeCardinalityRule({
        componentTypeId: 'type-01',
        minQuantity: 1,
        maxQuantity: 1,
      }),
      new TypeCardinalityRule({
        componentTypeId: 'type-04',
        minQuantity: 0,
        maxQuantity: null,
      }),
    ],
    activeStructurallyEligibleSizes: ['SIZE-00001'],
  });

function setup({ missing = false, commitError } = {}) {
  const products = new Map(missing ? [] : [[productId, makePizza()]]);
  const tx = { id: 'tx' };
  const productRepository = {
    findByIdForUpdate: jest.fn(
      async (id) => products.get(id.getValue()) ?? null,
    ),
    findById: jest.fn(async (id) => products.get(id.getValue()) ?? null),
    listPredefinedPizzas: jest.fn(async () => [...products.values()]),
    save: jest.fn(async (product) => {
      products.set(product.getId().getValue(), product);
      return product;
    }),
  };
  const referenceReader = { readFacts: jest.fn(async () => facts()) };
  const unitOfWork = {
    withTransaction: jest.fn(async (work) => {
      const before = new Map(products);
      try {
        const result = await work(tx);
        if (commitError) throw commitError;
        return result;
      } catch (error) {
        products.clear();
        for (const [id, product] of before) products.set(id, product);
        throw error;
      }
    }),
  };
  return {
    service: new PredefinedPizzaManagementService({
      productRepository,
      referenceReader,
      unitOfWork,
    }),
    productRepository,
    referenceReader,
    unitOfWork,
    products,
    tx,
  };
}

describe('BCK10 predefined pizza use cases over the Product aggregate', () => {
  test('defines a default composition on the existing Product using its ProductId', async () => {
    const { service, productRepository, referenceReader, tx } = setup();
    const result = await service.create(request);
    expect(result).toEqual({ id: productId, componentIds });
    expect(productRepository.findByIdForUpdate).toHaveBeenCalledWith(
      expect.any(ProductId),
      tx,
    );
    expect(referenceReader.readFacts).toHaveBeenCalledWith(
      productId,
      componentIds,
      tx,
    );
    expect(productRepository.save).toHaveBeenCalledTimes(1);
    expect(
      productRepository.save.mock.calls[0][0]
        .getCompositionItems()
        .map((item) => item.getQuantity().getAmount()),
    ).toEqual([1, 1]);
  });

  test('rejects a missing Product and does not write', async () => {
    const { service, productRepository } = setup({ missing: true });
    await expect(service.create(request)).rejects.toMatchObject({
      status: 404,
    });
    expect(productRepository.save).not.toHaveBeenCalled();
  });

  test('rejects invalid component facts without replacing existing composition', async () => {
    const context = setup();
    const invalid = facts();
    context.referenceReader.readFacts.mockResolvedValue(
      new ConfigurationFacts({
        representativeProduct: invalid.representativeProduct,
        components: [],
        typeRules: invalid.typeRules,
        activeStructurallyEligibleSizes: ['SIZE-00001'],
      }),
    );
    await expect(context.service.create(request)).rejects.toMatchObject({
      status: 404,
    });
    expect(context.productRepository.save).not.toHaveBeenCalled();
  });

  test('replaces, lists and consults composition by ProductId', async () => {
    const { service, productRepository } = setup();
    await service.create(request);
    const updated = await service.replaceConfiguration(productId, {
      componentIds: [componentIds[0]],
    });
    expect(updated).toEqual({ id: productId, componentIds: [componentIds[0]] });
    expect(await service.getById(productId)).toEqual(updated);
    expect(await service.list()).toEqual([updated]);
    expect(productRepository.save).toHaveBeenCalledTimes(2);
  });

  test('rejects repeated components before starting a transaction', async () => {
    const { service, unitOfWork } = setup();
    await expect(
      service.create({
        productId,
        componentIds: [componentIds[0], componentIds[0]],
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(unitOfWork.withTransaction).not.toHaveBeenCalled();
  });
});
