import { AppError } from '../../../src/shared/errors/AppError.js';
import { ProductService } from '../../../src/modules/product-management/application/services/ProductService.js';
import {
  MemoryProductImpactChecker,
  MemoryProductReferenceReader,
  MemoryProductRepository,
  MemoryUnitOfWork,
} from '../../helpers/MemoryProductRepository.js';

const sellable = (overrides = {}) => ({
  name: 'Coca-Cola 33cl',
  description: 'Soft drink can',
  categoryId: 'CAT-00001',
  isSellable: true,
  isPizzaComponent: false,
  acquisitionType: 'PURCHASED',
  compositionItems: [],
  pizzaComponentTypeId: null,
  allergenIds: [],
  pricingMode: 'FIXED',
  basePrice: 1.5,
  ...overrides,
});
const component = (overrides = {}) =>
  sellable({
    name: 'Mozzarella Cheese',
    description: 'Shredded mozzarella',
    isSellable: false,
    isPizzaComponent: true,
    acquisitionType: 'PRODUCED',
    pizzaComponentTypeId: 'type-03',
    allergenIds: [7],
    pricingMode: null,
    basePrice: null,
    ...overrides,
  });
const predefined = (overrides = {}) =>
  sellable({
    name: 'Margherita',
    acquisitionType: 'PRODUCED',
    compositionItems: [{ productId: 'PROD-00001', quantity: 2 }],
    pricingMode: 'COMPONENT_BASED',
    basePrice: null,
    ...overrides,
  });

let repository, references, impact, unitOfWork, service;
beforeEach(() => {
  repository = new MemoryProductRepository();
  references = new MemoryProductReferenceReader();
  references.productRepository = repository;
  impact = new MemoryProductImpactChecker();
  unitOfWork = new MemoryUnitOfWork(repository);
  service = new ProductService({
    productRepository: repository,
    referenceReader: references,
    impactChecker: impact,
    unitOfWork,
  });
});

const status = async (promise) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error.status;
  }
  throw new Error('Expected the operation to fail');
};

describe('BCK05 ProductService - create', () => {
  test('creates a product and returns its generated ID and state', async () => {
    const dto = await service.createProduct(component());
    expect(dto).toMatchObject({
      id: 'PROD-00001',
      name: 'Mozzarella Cheese',
      isActive: true,
      isPizzaComponent: true,
      acquisitionType: 'PRODUCED',
      pizzaComponentTypeId: 'type-03',
      allergenIds: [7],
      compositionItems: [],
      pricingMode: null,
      basePrice: null,
    });
    expect(repository.rows.size).toBe(1);
  });

  test('sums repeated composition product quantities and persists one entry', async () => {
    await service.createProduct(component());
    const created = await service.createProduct(
      predefined({
        compositionItems: [
          { productId: 'PROD-00001', quantity: 2 },
          { productId: 'PROD-00001', quantity: 3 },
        ],
      }),
    );
    expect(created.compositionItems).toEqual([
      { productId: 'PROD-00001', quantity: 5 },
    ]);
    expect(repository.rows.get(created.id).composition_items).toEqual([
      { product_id: 'PROD-00001', quantity: 5 },
    ]);
  });

  test('rejects malformed product data before opening a transaction', async () => {
    for (const dto of [
      sellable({ name: '' }),
      sellable({ categoryId: 'bad' }),
      sellable({ basePrice: 1.234 }),
      sellable({ acquisitionType: 'UNKNOWN' }),
      sellable({ isSellable: false }),
      component({ pizzaComponentTypeId: null }),
      component({ allergenIds: [7, 7] }),
      predefined({
        compositionItems: [
          { productId: 'PROD-00001', quantity: 2_147_483_647 },
          { productId: 'PROD-00001', quantity: 1 },
        ],
      }),
    ])
      expect(await status(service.createProduct(dto))).toBe(400);
    expect(unitOfWork.transactions).toBe(0);
  });

  test('allows duplicate names while assigning distinct IDs', async () => {
    const first = await service.createProduct(sellable());
    const second = await service.createProduct(sellable());
    expect(first.name).toBe(second.name);
    expect(first.id).not.toBe(second.id);
  });

  test('returns 404 for missing category, component type, allergen or composition product', async () => {
    expect(await status(service.createProduct(sellable({ categoryId: 'CAT-00099' })))).toBe(404);
    expect(await status(service.createProduct(component({ pizzaComponentTypeId: 'type-99' })))).toBe(404);
    references.allergens.delete(7);
    expect(await status(service.createProduct(component()))).toBe(404);
    expect(
      await status(
        service.createProduct(
          predefined({ compositionItems: [{ productId: 'PROD-00999', quantity: 1 }] }),
        ),
      ),
    ).toBe(404);
    expect(repository.rows.size).toBe(0);
  });
});

describe('BCK05 ProductService - update', () => {
  test('replaces editable data but preserves ID and active state', async () => {
    const created = await service.createProduct(sellable());
    await service.deactivateProduct(created.id);
    const current = await service.getProductById(created.id);
    const updated = await service.updateProduct(
      created.id,
      sellable({
        name: 'Coke Zero', allergenIds: [1], basePrice: 0,
        expectedUpdatedAt: current.updatedAt,
      }),
    );
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Coke Zero',
      allergenIds: [1],
      basePrice: 0,
      isActive: false,
    });
  });

  test('normalizes repeated composition items on update', async () => {
    await service.createProduct(component());
    const created = await service.createProduct(predefined());
    const updated = await service.updateProduct(
      created.id,
      predefined({
        expectedUpdatedAt: created.updatedAt,
        compositionItems: [
          { productId: 'PROD-00001', quantity: 4 },
          { productId: 'PROD-00001', quantity: 1 },
        ],
      }),
    );
    expect(updated.compositionItems).toEqual([
      { productId: 'PROD-00001', quantity: 5 },
    ]);
  });

  test('rejects composition cycles with 409', async () => {
    const first = await service.createProduct(predefined({ compositionItems: [] }));
    const second = await service.createProduct(
      predefined({
        name: 'Second pizza',
        compositionItems: [{ productId: first.id, quantity: 1 }],
      }),
    );
    expect(
      await status(
        service.updateProduct(
          first.id,
          predefined({
            expectedUpdatedAt: first.updatedAt,
            compositionItems: [{ productId: second.id, quantity: 1 }],
          }),
        ),
      ),
    ).toBe(409);
  });

  test('returns 404 for an unknown product and 400 for a malformed ID', async () => {
    expect(await status(service.updateProduct('PROD-00404', sellable()))).toBe(404);
    expect(await status(service.updateProduct('nope', sellable()))).toBe(400);
  });

  test('blocks removing component classification when an existing reference uses it', async () => {
    const created = await service.createProduct(component());
    impact.components.add(created.id);
    expect(
      await status(
        service.updateProduct(
          created.id,
          sellable({
            name: 'Mozzarella Cheese', basePrice: 2,
            expectedUpdatedAt: created.updatedAt,
          }),
        ),
      ),
    ).toBe(409);
  });
});

describe('BCK05 ProductService - activation and search', () => {
  test('deactivates and reactivates without changing product data', async () => {
    const created = await service.createProduct(component());
    await service.deactivateProduct(created.id);
    expect((await service.getProductById(created.id)).isActive).toBe(false);
    expect((await service.activateProduct(created.id)).isActive).toBe(true);
    expect((await service.getProductById(created.id)).name).toBe(created.name);
  });

  test('searches by partial name, classifications and acquisition type', async () => {
    await service.createProduct(component());
    await service.createProduct(sellable({ name: 'Orange Juice' }));
    expect((await service.listProducts({ name: 'mozz' })).map((item) => item.name)).toEqual([
      'Mozzarella Cheese',
    ]);
    expect((await service.listProducts({ isPizzaComponent: 'true' })).map((item) => item.name)).toEqual([
      'Mozzarella Cheese',
    ]);
    expect((await service.listProducts({ acquisitionType: 'PURCHASED' })).map((item) => item.name)).toEqual([
      'Orange Juice',
    ]);
  });

  test('rejects invalid search filters with 400', async () => {
    expect(await status(service.listProducts({ isActive: 'yes' }))).toBe(400);
    expect(await status(service.listProducts({ acquisitionType: 'UNKNOWN' }))).toBe(400);
  });
});
