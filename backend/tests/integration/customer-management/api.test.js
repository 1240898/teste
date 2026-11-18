import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createCustomerModule } from '../../../src/modules/customer-management/index.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createUser } from '../../helpers/createUser.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';

const security = {
  secret: 'test-only-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const linkedUserId = 'USR-00001';
const inactiveUserId = 'USR-00002';
const nonCustomerUserId = 'USR-00003';
const auth = (token) => ({ Authorization: `Bearer ${token}` });

function createMemoryCustomerRepository() {
  const customers = new Map();
  let next = 1;
  return {
    async nextId() {
      return `CUST-${String(next++).padStart(4, '0')}`;
    },
    async findById(id) {
      return customers.get(id.getValue()) ?? null;
    },
    async findByEmail(email) {
      return (
        [...customers.values()].find(
          (customer) => customer.contactInfo.email.getValue() === email,
        ) ?? null
      );
    },
    async existsByEmail(email) {
      return Boolean(await this.findByEmail(email));
    },
    async findByUserId(id) {
      return (
        [...customers.values()].find(
          (customer) => customer.userId?.getValue() === id,
        ) ?? null
      );
    },
    async save(customer) {
      customers.set(customer.id.getValue(), customer);
      return customer;
    },
    async search(criteria) {
      return [...customers.values()].filter(
        (customer) =>
          ['name', 'email', 'phoneNumber'].every((field) => {
            const query = criteria[field];
            if (!query) return true;
            const actual =
              field === 'name'
                ? customer.name.getValue()
                : field === 'email'
                  ? customer.contactInfo.email.getValue()
                  : customer.contactInfo.phoneNumber.getValue();
            return actual.toLowerCase().includes(query.toLowerCase());
          }) &&
          (!criteria.userId || customer.userId?.getValue() === criteria.userId),
      );
    },
  };
}

let app;
let managerToken;
let employeeToken;
let customerToken;
let repository;

beforeEach(async () => {
  const userModule = createUserModule({
    repository: new MemoryUserRepository(),
    security,
  });
  const passwordHash = await userModule.hasher.hash('long-password');
  const accounts = [
    {
      name: 'Manager',
      email: 'manager@example.com',
      roles: ['MANAGER', 'EMPLOYEE'],
    },
    { name: 'Employee', email: 'employee@example.com', roles: ['EMPLOYEE'] },
    { name: 'Customer', email: 'customer@example.com', roles: ['CUSTOMER'] },
  ];
  const tokens = [];
  for (const account of accounts) {
    const user = createUser({ ...account, passwordHash });
    await userModule.userService.userRepository.save(user);
    tokens.push(
      userModule.tokens.generateToken({
        sub: user.getId().getValue(),
        email: user.getEmail().getValue(),
        roles: user.getRoles(),
      }),
    );
  }

  repository = createMemoryCustomerRepository();
  app = createApp({
    userModule,
    customerModule: createCustomerModule({
      userService: userModule.userService,
      repository,
      userDirectory: {
        findById: async (id) => {
          if (id === linkedUserId)
            return {
              email: 'ana@example.com',
              active: true,
              roles: ['CUSTOMER'],
            };
          if (id === inactiveUserId)
            return {
              email: 'inactive@example.com',
              active: false,
              roles: ['CUSTOMER'],
            };
          if (id === nonCustomerUserId)
            return {
              email: 'staff@example.com',
              active: true,
              roles: ['EMPLOYEE'],
            };
          return null;
        },
      },
    }),
  });
  [managerToken, employeeToken, customerToken] = tokens;
});

const customerBody = (overrides = {}) => ({
  name: 'Ana Silva',
  phoneNumber: '+351912345678',
  email: 'ana@example.com',
  dietaryRestrictions: [{ name: 'Lactose', description: 'Avoid dairy' }],
  ...overrides,
});

describe('BCK02 customer HTTP API', () => {
  test('requires an authenticated manager for customer operations', async () => {
    expect((await request(app).get('/api/v1/customers')).status).toBe(401);
    for (const token of [employeeToken, customerToken]) {
      expect(
        (await request(app).get('/api/v1/customers').set(auth(token))).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post('/api/v1/customers')
            .set(auth(token))
            .send(customerBody())
        ).status,
      ).toBe(403);
    }
  });

  test('creates, retrieves, searches, updates and changes customer activation', async () => {
    const created = await request(app)
      .post('/api/v1/customers')
      .set(auth(managerToken))
      .send(
        customerBody({
          email: ' ANA@example.com ',
          phoneNumber: '+351 912-345-678',
        }),
      );
    expect(created.status).toBe(201);
    expect(created.headers.location).toBe('/api/v1/customers/CUST-0001');
    expect(created.body).toMatchObject({
      id: 'CUST-0001',
      email: 'ana@example.com',
      phoneNumber: '+351912345678',
      active: true,
    });

    const fetched = await request(app)
      .get(created.headers.location)
      .set(auth(managerToken));
    expect(fetched.status).toBe(200);
    expect(fetched.body.dietaryRestrictions).toEqual([
      { name: 'Lactose', description: 'Avoid dairy', allergenId: null },
    ]);
    const searched = await request(app)
      .get('/api/v1/customers?name=ANA&email=EXAMPLE.COM')
      .set(auth(managerToken));
    expect(searched.status).toBe(200);
    expect(searched.body.map(({ id }) => id)).toEqual(['CUST-0001']);

    const updated = await request(app)
      .put(created.headers.location)
      .set(auth(managerToken))
      .send(
        customerBody({
          name: 'Ana Costa',
          dietaryRestrictions: [{ name: 'Gluten' }],
        }),
      );
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      name: 'Ana Costa',
      dietaryRestrictions: [{ name: 'Gluten', description: null }],
    });
    expect(
      (
        await request(app)
          .patch(`${created.headers.location}/deactivate`)
          .set(auth(managerToken))
      ).status,
    ).toBe(204);
    expect(
      (await request(app).get(created.headers.location).set(auth(managerToken)))
        .body.active,
    ).toBe(false);
    expect(
      (
        await request(app)
          .patch(`${created.headers.location}/activate`)
          .set(auth(managerToken))
      ).status,
    ).toBe(204);
    expect(
      (await request(app).get(created.headers.location).set(auth(managerToken)))
        .body.active,
    ).toBe(true);
  });

  test('rejects invalid input, duplicate contacts, invalid IDs and unknown customers', async () => {
    const invalid = await request(app)
      .post('/api/v1/customers')
      .set(auth(managerToken))
      .send(customerBody({ email: 'not-an-email' }));
    expect(invalid.status).toBe(400);
    const created = await request(app)
      .post('/api/v1/customers')
      .set(auth(managerToken))
      .send(customerBody());
    const duplicate = await request(app)
      .post('/api/v1/customers')
      .set(auth(managerToken))
      .send(customerBody({ email: 'ANA@example.com' }));
    expect(duplicate.status).toBe(409);
    expect(
      (
        await request(app)
          .get('/api/v1/customers/bad-id')
          .set(auth(managerToken))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get('/api/v1/customers/CUST-9999')
          .set(auth(managerToken))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get('/api/v1/customers?unknown=yes')
          .set(auth(managerToken))
      ).status,
    ).toBe(400);
    expect(created.status).toBe(201);
  });

  test('links an existing user and rejects missing or already-linked users', async () => {
    const created = await request(app)
      .post('/api/v1/customers')
      .set(auth(managerToken))
      .send(customerBody({ userId: linkedUserId }));
    expect(created.status).toBe(201);
    expect(created.body.userId).toBe(linkedUserId);
    const duplicateLink = await request(app)
      .post('/api/v1/customers')
      .set(auth(managerToken))
      .send(customerBody({ email: 'ana@example.com', userId: linkedUserId }));
    expect(duplicateLink.status).toBe(409);
    const unknownUser = await request(app)
      .post('/api/v1/customers')
      .set(auth(managerToken))
      .send(
        customerBody({ email: 'third@example.com', userId: 'unknown-user' }),
      );
    expect(unknownUser.status).toBe(400);
    const inactiveUser = await request(app)
      .post('/api/v1/customers')
      .set(auth(managerToken))
      .send(
        customerBody({
          email: 'inactive@example.com',
          userId: inactiveUserId,
        }),
      );
    expect(inactiveUser.status).toBe(400);
    const userWithoutCustomerRole = await request(app)
      .post('/api/v1/customers')
      .set(auth(managerToken))
      .send(
        customerBody({ email: 'staff@example.com', userId: nonCustomerUserId }),
      );
    expect(userWithoutCustomerRole.status).toBe(400);
  });
});
