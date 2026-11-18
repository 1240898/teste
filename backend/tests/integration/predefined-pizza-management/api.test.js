import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { AuthMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/authMiddleware.js';
import { createPredefinedPizzaManagementModule } from '../../../src/modules/predefined-pizza-management/index.js';
import { Product } from '../../../src/modules/product-management/domain/model/Product.js';
import { AcquisitionType } from '../../../src/modules/product-management/domain/model/AcquisitionType.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { createUser } from '../../helpers/createUser.js';
import {
  ComponentEligibility,
  ConfigurationFacts,
  ProductEligibility,
  TypeCardinalityRule,
} from '../../../src/modules/predefined-pizza-management/domain/model/ConfigurationFacts.js';

const security = {
  secret: 'predefined-pizza-test-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const passwordHash = '$2b$10$' + 'a'.repeat(53);
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const pizza = {
  productId: 'PROD-00123',
  componentIds: ['PROD-00124', 'PROD-00125'],
};

function facts({ representativeIsPizzaComponent = false } = {}) {
  return new ConfigurationFacts({
    representativeProduct: new ProductEligibility({
      productId: pizza.productId,
      isSellable: true,
      isPizzaComponent: representativeIsPizzaComponent,
    }),
    components: pizza.componentIds.map(
      (productId, index) =>
        new ComponentEligibility({
          productId,
          isActive: true,
          isPizzaComponent: true,
          componentTypeId: `TYPE-${index + 1}`,
        }),
    ),
    typeRules: pizza.componentIds.map(
      (_id, index) =>
        new TypeCardinalityRule({
          componentTypeId: `TYPE-${index + 1}`,
          minQuantity: 0,
          maxQuantity: 1,
        }),
    ),
    activeStructurallyEligibleSizes: ['SIZE-00001'],
  });
}

describe('BCK10 Manager API with BCK01 security and in-memory persistence', () => {
  let app;
  let pizzas;
  let managerToken;
  let customerToken;
  let readFacts;

  beforeEach(async () => {
    const users = new MemoryUserRepository();
    const userModule = createUserModule({ repository: users, security });
    const manager = createUser({
      name: 'Manager',
      email: 'manager@example.com',
      passwordHash,
      roles: ['MANAGER'],
    });
    const customer = createUser({
      name: 'Customer',
      email: 'customer@example.com',
      passwordHash,
      roles: ['CUSTOMER'],
    });
    await users.save(manager);
    await users.save(customer);
    managerToken = userModule.tokens.generateToken({
      sub: manager.getId().getValue(),
      email: manager.getEmail().getValue(),
      roles: manager.getRoles(),
    });
    customerToken = userModule.tokens.generateToken({
      sub: customer.getId().getValue(),
      email: customer.getEmail().getValue(),
      roles: customer.getRoles(),
    });

    pizzas = new Map([
      [
        pizza.productId,
        Product.restore({
          id: pizza.productId,
          name: 'Example Pizza',
          description: 'Example',
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
        }),
      ],
    ]);
    const productRepository = {
      findById: async (id) => pizzas.get(id.getValue()) ?? null,
      findByIdForUpdate: async (id) => pizzas.get(id.getValue()) ?? null,
      save: async (item) => {
        pizzas.set(item.getId().getValue(), item);
        return item;
      },
      listPredefinedPizzas: async () => [...pizzas.values()],
    };
    readFacts = jest.fn(async () => facts());
    const unitOfWork = { withTransaction: async (work) => work({}) };
    const predefinedPizzaModule = createPredefinedPizzaManagementModule({
      productRepository,
      referenceReader: { readFacts },
      unitOfWork,
      authMiddleware: new AuthMiddleware(userModule.userService),
    });
    app = createApp({ userModule, predefinedPizzaModule });
  });

  test('protects Manager workflows and creates, lists, consults and replaces default configuration', async () => {
    expect((await request(app).get('/api/v1/predefined-pizzas')).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .get('/api/v1/predefined-pizzas')
          .set(auth(customerToken))
      ).status,
    ).toBe(403);

    const created = await request(app)
      .post('/api/v1/predefined-pizzas')
      .set(auth(managerToken))
      .send(pizza);
    expect(created.status).toBe(201);
    expect(created.headers.location).toBe(
      '/api/v1/predefined-pizzas/PROD-00123',
    );
    expect(created.body).toEqual({
      id: pizza.productId,
      componentIds: pizza.componentIds,
    });

    const listing = await request(app)
      .get('/api/v1/predefined-pizzas')
      .set(auth(managerToken));
    expect(listing.status).toBe(200);
    expect(listing.body).toEqual([created.body]);
    expect(JSON.stringify(listing.body)).not.toMatch(
      /price|availability|stock/i,
    );

    const consulted = await request(app)
      .get('/api/v1/predefined-pizzas/PROD-00123')
      .set(auth(managerToken));
    expect(consulted.status).toBe(200);
    expect(consulted.body).toEqual(created.body);

    const replacement = await request(app)
      .put('/api/v1/predefined-pizzas/PROD-00123/default-configuration')
      .set(auth(managerToken))
      .send({ componentIds: ['PROD-00124'] });
    expect(replacement.status).toBe(200);
    expect(replacement.body).toEqual({
      ...created.body,
      componentIds: ['PROD-00124'],
    });
  });

  test('rejects invalid IDs and rejects a Pizza Component representative on create and replacement', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/predefined-pizzas')
          .set(auth(managerToken))
          .send({ ...pizza, productId: 'bad-id' })
      ).status,
    ).toBe(400);
    readFacts.mockImplementation(async (_productId, _componentIds) =>
      facts({ representativeIsPizzaComponent: true }),
    );
    expect(
      (
        await request(app)
          .post('/api/v1/predefined-pizzas')
          .set(auth(managerToken))
          .send(pizza)
      ).status,
    ).toBe(409);

    readFacts.mockImplementation(async () => facts());
    await request(app)
      .post('/api/v1/predefined-pizzas')
      .set(auth(managerToken))
      .send(pizza);
    readFacts.mockImplementation(async () =>
      facts({ representativeIsPizzaComponent: true }),
    );
    const replaced = await request(app)
      .put('/api/v1/predefined-pizzas/PROD-00123/default-configuration')
      .set(auth(managerToken))
      .send({ componentIds: ['PROD-00124'] });
    expect(replaced.status).toBe(409);
    expect(
      pizzas
        .get(pizza.productId)
        .getCompositionItems()
        .map((item) => item.getProductId().getValue()),
    ).toEqual(pizza.componentIds);
  });
});
