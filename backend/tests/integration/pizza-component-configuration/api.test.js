import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { AuthMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/authMiddleware.js';
import { createPizzaComponentConfigurationModule } from '../../../src/modules/pizza-component-configuration/index.js';
import {
  PizzaSizeId,
  ProductId,
} from '../../../src/modules/pizza-component-configuration/domain/model/values.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { createUser } from '../../helpers/createUser.js';

const security = {
  secret: 'component-configuration-test-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const passwordHash = '$2b$10$' + 'a'.repeat(53);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const product = {
  getId: () => ProductId.create('product-1'),
  isPizzaComponent: () => true,
  isStockControlled: () => true,
};
const size = { getId: () => PizzaSizeId.create('size-m') };

function setupAdapters() {
  const configurations = new Map();
  const key = (productId, sizeId) =>
    `${productId.getValue()}:${sizeId.getValue()}`;
  const products = {
    findById: async (id) => (id.getValue() === 'product-1' ? product : null),
    findByIdForUpdate: async (id) =>
      id.getValue() === 'product-1' ? product : null,
  };
  const sizes = {
    findById: async (id) => (id.getValue() === 'size-m' ? size : null),
    findByIdForUpdate: async (id) => (id.getValue() === 'size-m' ? size : null),
  };
  const repository = {
    findByPair: async (productId, sizeId) =>
      configurations.get(key(productId, sizeId)) ?? null,
    findByPairForUpdate: async (productId, sizeId) =>
      configurations.get(key(productId, sizeId)) ?? null,
    findByProduct: async (productId) =>
      [...configurations.values()].filter(
        (configuration) =>
          configuration.getProductId().getValue() === productId.getValue(),
      ),
    insert: async (configuration) =>
      configurations.set(
        key(configuration.getProductId(), configuration.getSizeId()),
        configuration,
      ),
    save: async (configuration) =>
      configurations.set(
        key(configuration.getProductId(), configuration.getSizeId()),
        configuration,
      ),
  };
  return { products, sizes, repository, configurations };
}

describe('BCK08 HTTP API with BCK01 security and test doubles for dependencies', () => {
  let app;
  let managerToken;
  let customerToken;

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

    const adapters = setupAdapters();
    const componentConfigurationModule =
      createPizzaComponentConfigurationModule({
        ...adapters,
        unitOfWork: { withTransaction: async (work) => work({}) },
        impactGuard: { assertSafeChange: async () => {} },
        authMiddleware: new AuthMiddleware(userModule.userService),
      });
    app = createApp({ userModule, componentConfigurationModule });
  });

  test('protects the endpoints and creates/consults a configuration', async () => {
    expect(
      (
        await request(app).get(
          '/api/v1/products/product-1/component-configurations',
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/v1/products/product-1/component-configurations')
          .set(auth(customerToken))
      ).status,
    ).toBe(403);

    const created = await request(app)
      .post('/api/v1/products/product-1/component-configurations/size-m')
      .set(auth(managerToken))
      .send({ amount: '2.5', currency: 'EUR', stockUnitsConsumed: 2 });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      productId: 'product-1',
      sizeId: 'size-m',
      amount: '2.50',
      currency: 'EUR',
      stockUnitsConsumed: 2,
    });
    expect(created.headers.location).toBe(
      '/api/v1/products/product-1/component-configurations/size-m',
    );

    const consulted = await request(app)
      .get('/api/v1/products/product-1/component-configurations')
      .set(auth(managerToken));
    expect(consulted.status).toBe(200);
    expect(consulted.body).toEqual([created.body]);
  });

  test('validates strict DTOs and partially updates a configuration', async () => {
    const invalid = await request(app)
      .post('/api/v1/products/product-1/component-configurations/size-m')
      .set(auth(managerToken))
      .send({ amount: 2, currency: 'EUR', stockUnitsConsumed: 2 });
    expect(invalid.status).toBe(400);

    const created = await request(app)
      .post('/api/v1/products/product-1/component-configurations/size-m')
      .set(auth(managerToken))
      .send({ amount: '1.00', currency: 'EUR', stockUnitsConsumed: 1 });
    expect(created.status).toBe(201);

    const emptyPatch = await request(app)
      .patch('/api/v1/products/product-1/component-configurations/size-m')
      .set(auth(managerToken))
      .send({});
    expect(emptyPatch.status).toBe(400);

    const updated = await request(app)
      .patch('/api/v1/products/product-1/component-configurations/size-m')
      .set(auth(managerToken))
      .send({ amount: '3', stockUnitsConsumed: 0 });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      productId: 'product-1',
      sizeId: 'size-m',
      amount: '3.00',
      currency: 'EUR',
      stockUnitsConsumed: 0,
    });
  });
});
