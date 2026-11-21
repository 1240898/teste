import { ContactInfo } from '../../../src/modules/customer-management/domain/model/values.js';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createCustomerModule } from '../../../src/modules/customer-management/index.js';
import { CustomerAccountProfileService } from '../../../src/modules/customer-management/application/services/CustomerAccountProfileService.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createUser } from '../../helpers/createUser.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';

// GDP01 follow-up: phone number at registration, the Customer's own record,
// allergens with explicit consent (GDPR Art. 9(2)(a)) and marketing consent.
const security = {
  secret: 'test-only-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const PASSWORD = 'Valid-Password-123!';
const ALLERGENS = new Map([
  [1, 'Gluten'],
  [7, 'Milk'],
  [8, 'Nuts'],
]);

function memoryCustomers() {
  const customers = new Map();
  let next = 1;
  const byEmail = (email) =>
    [...customers.values()].find(
      (c) => c.contactInfo.email.getValue() === email,
    ) ?? null;
  return {
    customers,
    async nextId() {
      return `CUST-${String(next++).padStart(4, '0')}`;
    },
    async findById(id) {
      return customers.get(id.getValue()) ?? null;
    },
    async findByEmail(email) {
      return byEmail(email);
    },
    async existsByEmail(email) {
      return Boolean(byEmail(email));
    },
    async findByUserId(id) {
      return (
        [...customers.values()].find((c) => c.userId?.getValue() === id) ?? null
      );
    },
    async update(id, change) {
      return this.save(await change(await this.findById(id)));
    },
    async updateOwnedContact(id, userId, name, phoneNumber) {
      const customer = await this.findById(id);
      if (customer?.userId?.getValue() !== userId) return null;
      customer.updateName(name);
      customer.updateContactInfo(
        ContactInfo.create(
          customer.contactInfo.email.getValue(),
          phoneNumber.getValue(),
        ),
      );
      return this.save(customer);
    },
    async save(customer) {
      customers.set(customer.id.getValue(), customer);
      return customer;
    },
    async search() {
      return [...customers.values()];
    },
  };
}

let app;
let users;
let customers;
let userModule;
let tokens;

async function account(name, email, roles) {
  const passwordHash = await userModule.hasher.hash('long-password');
  const user = createUser({ name, email, passwordHash, roles });
  await users.save(user);
  return {
    id: user.getId().getValue(),
    token: userModule.tokens.generateToken({
      sub: user.getId().getValue(),
      email,
      roles: user.getRoles(),
    }),
  };
}

beforeEach(async () => {
  users = new MemoryUserRepository();
  customers = memoryCustomers();
  userModule = createUserModule({
    repository: users,
    security,
    customerProfiles: new CustomerAccountProfileService(customers),
  });
  app = createApp({
    userModule,
    customerModule: createCustomerModule({
      userService: userModule.userService,
      repository: customers,
      userDirectory: {
        findById: async (id) => {
          const row = users.users.get(id);
          return row
            ? {
                name: row.name,
                email: row.email,
                active: row.active,
                roles: row.roles,
              }
            : null;
        },
      },
      allergenCatalogue: {
        findByIds: async (ids) =>
          ids
            .filter((id) => ALLERGENS.has(id))
            .map((id) => ({ id, name: ALLERGENS.get(id) })),
      },
    }),
  });
  tokens = {
    // Same state as a first Google sign-in: active CUSTOMER, no customer record.
    customer: await account('Rita', 'rita@example.com', ['CUSTOMER']),
    manager: await account('Manager', 'manager@example.com', ['MANAGER']),
  };
});

describe('local registration', () => {
  test('requires a phone number and creates the linked customer record', async () => {
    const missing = await request(app)
      .post('/api/v1/users/register')
      .send({ name: 'Ana', email: 'ana@example.com', password: PASSWORD });
    expect(missing.status).toBe(400);

    const invalid = await request(app).post('/api/v1/users/register').send({
      name: 'Ana',
      email: 'ana@example.com',
      password: PASSWORD,
      phoneNumber: '912345678',
    });
    expect(invalid.status).toBe(400);
    expect(users.users.size).toBe(2);

    const created = await request(app).post('/api/v1/users/register').send({
      name: 'Ana',
      email: 'ana@example.com',
      password: PASSWORD,
      phoneNumber: '+351 912 345 678',
    });
    expect(created.status).toBe(201);
    const record = await customers.findByUserId(created.body.id);
    expect(record.contactInfo.phoneNumber.getValue()).toBe('+351912345678');
    expect(record.contactInfo.email.getValue()).toBe('ana@example.com');
    expect(record.hasHealthDataConsent()).toBe(false);
  });

  test('leaves a Manager-created record with the same e-mail untouched', async () => {
    await request(app)
      .post('/api/v1/customers')
      .set(auth(tokens.manager.token))
      .send({
        name: 'Ana Silva',
        email: 'ana@example.com',
        phoneNumber: '+351911111111',
      });
    const created = await request(app).post('/api/v1/users/register').send({
      name: 'Ana',
      email: 'ana@example.com',
      password: PASSWORD,
      phoneNumber: '+351922222222',
    });
    expect(created.status).toBe(201);
    const [record] = [...customers.customers.values()];
    expect(customers.customers.size).toBe(1);
    expect(record.userId).toBeNull();
    expect(record.contactInfo.phoneNumber.getValue()).toBe('+351911111111');
  });
});

describe('customer profile completion (first external sign-in)', () => {
  test('GET /customers/me is 404 until the phone number is provided', async () => {
    const me = auth(tokens.customer.token);
    expect(
      (await request(app).get('/api/v1/customers/me').set(me)).status,
    ).toBe(404);
    const done = await request(app)
      .post('/api/v1/customers/me')
      .set(me)
      .send({ phoneNumber: '+351933333333' });
    expect(done.status).toBe(201);
    expect(done.body).toMatchObject({
      name: 'Rita',
      email: 'rita@example.com',
      phoneNumber: '+351933333333',
      userId: tokens.customer.id,
      healthDataConsent: { given: false, timestamp: null },
    });
    expect(
      (await request(app).get('/api/v1/customers/me').set(me)).status,
    ).toBe(200);
    const again = await request(app)
      .post('/api/v1/customers/me')
      .set(me)
      .send({ phoneNumber: '+351933333333' });
    expect(again.status).toBe(409);
  });

  test('links a Manager-created record for the same verified e-mail', async () => {
    await request(app)
      .post('/api/v1/customers')
      .set(auth(tokens.manager.token))
      .send({
        name: 'Rita Costa',
        email: 'rita@example.com',
        phoneNumber: '+351911111111',
      });
    const done = await request(app)
      .post('/api/v1/customers/me')
      .set(auth(tokens.customer.token))
      .send({ phoneNumber: '+351933333333' });
    expect(done.status).toBe(201);
    expect(customers.customers.size).toBe(1);
    expect(done.body).toMatchObject({
      name: 'Rita Costa',
      phoneNumber: '+351933333333',
      userId: tokens.customer.id,
    });
  });

  test('only the CUSTOMER role can use /customers/me', async () => {
    const res = await request(app)
      .get('/api/v1/customers/me')
      .set(auth(tokens.manager.token));
    expect(res.status).toBe(403);
  });
});

describe('own allergens and health-data consent', () => {
  const me = () => auth(tokens.customer.token);
  beforeEach(async () => {
    await request(app)
      .post('/api/v1/customers/me')
      .set(me())
      .send({ phoneNumber: '+351933333333' });
  });

  test('allergens require explicit consent', async () => {
    const res = await request(app)
      .put('/api/v1/customers/me/allergens')
      .set(me())
      .send({ healthDataConsent: false, allergenIds: [1] });
    expect(res.status).toBe(400);
    expect(
      (
        await request(app)
          .put('/api/v1/customers/me/allergens')
          .set(me())
          .send({ allergenIds: [1] })
      ).status,
    ).toBe(400);
  });

  test('consent stores the selected allergens; withdrawal erases them', async () => {
    const saved = await request(app)
      .put('/api/v1/customers/me/allergens')
      .set(me())
      .send({ healthDataConsent: true, allergenIds: [7, 1] });
    expect(saved.status).toBe(200);
    expect(saved.body.healthDataConsent.given).toBe(true);
    expect(saved.body.healthDataConsent.timestamp).toEqual(expect.any(String));
    expect(saved.body.dietaryRestrictions).toEqual([
      { name: 'Gluten', description: null, allergenId: 1 },
      { name: 'Milk', description: null, allergenId: 7 },
    ]);

    const withdrawn = await request(app)
      .put('/api/v1/customers/me/allergens')
      .set(me())
      .send({ healthDataConsent: false });
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.healthDataConsent.given).toBe(false);
    expect(withdrawn.body.dietaryRestrictions).toEqual([]);
  });

  test('unknown allergens are rejected', async () => {
    const res = await request(app)
      .put('/api/v1/customers/me/allergens')
      .set(me())
      .send({ healthDataConsent: true, allergenIds: [2] });
    expect(res.status).toBe(400);
  });

  test('the customer updates name and phone but not the e-mail', async () => {
    const res = await request(app)
      .put('/api/v1/customers/me')
      .set(me())
      .send({ name: 'Rita C.', phoneNumber: '+351944444444' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Rita C.',
      phoneNumber: '+351944444444',
      email: 'rita@example.com',
    });
    expect(
      (
        await request(app).put('/api/v1/customers/me').set(me()).send({
          name: 'Rita',
          phoneNumber: '+351944444444',
          email: 'x@example.com',
        })
      ).status,
    ).toBe(400);
  });
});

describe('Manager form and health-data consent', () => {
  test('dietary restrictions without consent are rejected', async () => {
    const body = {
      name: 'Ana',
      email: 'ana@example.com',
      phoneNumber: '+351912345678',
      dietaryRestrictions: [{ name: 'Gluten', allergenId: 1 }],
    };
    const manager = auth(tokens.manager.token);
    expect(
      (await request(app).post('/api/v1/customers').set(manager).send(body))
        .status,
    ).toBe(400);
    const created = await request(app)
      .post('/api/v1/customers')
      .set(manager)
      .send({ ...body, healthDataConsent: true });
    expect(created.status).toBe(201);
    expect(created.body.healthDataConsent.given).toBe(true);
  });

  test('manager contact edits preserve existing consent and restrictions when omitted', async () => {
    const headers = auth(tokens.manager.token);
    const contact = {
      name: 'Ana Silva',
      email: 'ana@example.com',
      phoneNumber: '+351912345678',
    };
    const created = await request(app)
      .post('/api/v1/customers')
      .set(headers)
      .send({
        ...contact,
        dietaryRestrictions: [{ name: 'Gluten', allergenId: 1 }],
        healthDataConsent: true,
      })
      .expect(201);

    const edited = await request(app)
      .put(`/api/v1/customers/${created.body.id}`)
      .set(headers)
      .send({ ...contact, name: 'Ana Costa' })
      .expect(200);

    expect(edited.body).toMatchObject({
      name: 'Ana Costa',
      dietaryRestrictions: created.body.dietaryRestrictions,
      healthDataConsent: created.body.healthDataConsent,
    });
  });
});

describe('marketing consent', () => {
  test('the user gives and withdraws marketing consent', async () => {
    const me = auth(tokens.customer.token);
    const given = await request(app)
      .put('/api/v1/auth/me/marketing-consent')
      .set(me)
      .send({ marketingConsent: true });
    expect(given.status).toBe(200);
    expect(given.body.marketingConsent).toBe(true);
    const withdrawn = await request(app)
      .put('/api/v1/auth/me/marketing-consent')
      .set(me)
      .send({ marketingConsent: false });
    expect(withdrawn.body.marketingConsent).toBe(false);
    expect(
      (
        await request(app)
          .put('/api/v1/auth/me/marketing-consent')
          .set(me)
          .send({ marketingConsent: 'yes' })
      ).status,
    ).toBe(400);
  });
});
