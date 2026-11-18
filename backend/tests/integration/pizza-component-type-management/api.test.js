import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { AuthMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/authMiddleware.js';
import { createPizzaComponentTypeModule } from '../../../src/modules/pizza-component-type-management/index.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { createUser } from '../../helpers/createUser.js';
import {
  MemoryComponentTypeRepository,
  MemoryComponentTypeUnitOfWork,
} from '../../helpers/MemoryComponentTypeRepository.js';

const security = {
  secret: 'component-type-test-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const passwordHash = '$2b$10$' + 'a'.repeat(53);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('BCK07 HTTP API with BCK01 security and in-memory persistence', () => {
  let app;
  let repository;
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
    repository = new MemoryComponentTypeRepository();
    const componentTypeModule = createPizzaComponentTypeModule({
      repository,
      unitOfWork: new MemoryComponentTypeUnitOfWork(repository),
      impactGuard: {
        assertSafeCreate: async () => {},
        assertSafeUpdate: async () => {},
        assertSafeRemoval: async () => {},
      },
      authMiddleware: new AuthMiddleware(userModule.userService),
    });
    app = createApp({ userModule, componentTypeModule });
  });

  test('protects the collection and applies exact case-insensitive OR search', async () => {
    const first = await request(app)
      .post('/api/v1/pizza-component-types')
      .set(auth(managerToken))
      .send({
        name: 'Topping',
        assemblyOrder: 4,
        minQuantity: 0,
        maxQuantity: null,
      });
    expect(first.status).toBe(201);
    expect(first.headers.location).toBe(
      `/api/v1/pizza-component-types/${first.body.id}`,
    );

    const second = await request(app)
      .post('/api/v1/pizza-component-types')
      .set(auth(managerToken))
      .send({
        name: 'Cheese',
        assemblyOrder: 3,
        minQuantity: 0,
        maxQuantity: 1,
      });
    expect(second.status).toBe(201);

    expect(
      (await request(app).get('/api/v1/pizza-component-types')).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/v1/pizza-component-types')
          .set(auth(customerToken))
      ).status,
    ).toBe(403);

    const all = await request(app)
      .get('/api/v1/pizza-component-types')
      .set(auth(managerToken));
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);

    const exactName = await request(app)
      .get('/api/v1/pizza-component-types?name=tOPPING')
      .set(auth(managerToken));
    expect(exactName.body).toHaveLength(1);
    expect(exactName.body[0].id).toBe(first.body.id);

    const eitherFilter = await request(app)
      .get(`/api/v1/pizza-component-types?id=${first.body.id}&name=Cheese`)
      .set(auth(managerToken));
    expect(eitherFilter.body).toHaveLength(2);
  });

  test('validates bounds, partially updates, consults and removes', async () => {
    const invalid = await request(app)
      .post('/api/v1/pizza-component-types')
      .set(auth(managerToken))
      .send({
        name: 'Invalid',
        assemblyOrder: 1,
        minQuantity: 2,
        maxQuantity: 1,
      });
    expect(invalid.status).toBe(400);

    const created = await request(app)
      .post('/api/v1/pizza-component-types')
      .set(auth(managerToken))
      .send({
        name: 'Sauce',
        assemblyOrder: 2,
        minQuantity: 0,
        maxQuantity: 1,
      });
    const id = created.body.id;

    const updated = await request(app)
      .patch(`/api/v1/pizza-component-types/${id}`)
      .set(auth(managerToken))
      .send({ maxQuantity: null });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id,
      name: 'Sauce',
      maxQuantity: null,
    });

    const consulted = await request(app)
      .get(`/api/v1/pizza-component-types/${id}`)
      .set(auth(managerToken));
    expect(consulted.body).toMatchObject({ id, maxQuantity: null });

    expect(
      (
        await request(app)
          .delete(`/api/v1/pizza-component-types/${id}`)
          .set(auth(managerToken))
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .get(`/api/v1/pizza-component-types/${id}`)
          .set(auth(managerToken))
      ).status,
    ).toBe(404);
  });

  test('rejects duplicate names/orders and preserves existing records', async () => {
    const dough = await request(app)
      .post('/api/v1/pizza-component-types')
      .set(auth(managerToken))
      .send({
        name: 'Dough',
        assemblyOrder: 1,
        minQuantity: 1,
        maxQuantity: 1,
      });
    const other = await request(app)
      .post('/api/v1/pizza-component-types')
      .set(auth(managerToken))
      .send({
        name: 'Other',
        assemblyOrder: 2,
        minQuantity: 0,
        maxQuantity: 1,
      });

    const duplicateName = await request(app)
      .post('/api/v1/pizza-component-types')
      .set(auth(managerToken))
      .send({
        name: 'dOUGH',
        assemblyOrder: 2,
        minQuantity: 0,
        maxQuantity: 1,
      });
    expect(duplicateName.status).toBe(409);

    const duplicateRename = await request(app)
      .patch(`/api/v1/pizza-component-types/${other.body.id}`)
      .set(auth(managerToken))
      .send({ name: 'dOUGH' });
    expect(duplicateRename.status).toBe(409);
    expect(repository.types.get(other.body.id).getName().getValue()).toBe(
      'Other',
    );

    const duplicateOrder = await request(app)
      .post('/api/v1/pizza-component-types')
      .set(auth(managerToken))
      .send({
        name: 'New Type',
        assemblyOrder: 1,
        minQuantity: 0,
        maxQuantity: 1,
      });
    expect(duplicateOrder.status).toBe(409);
    expect(repository.types.size).toBe(2);
    expect(repository.types.has(dough.body.id)).toBe(true);
  });
});
