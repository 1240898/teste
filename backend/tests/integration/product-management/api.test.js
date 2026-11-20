
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createProductManagementModule } from '../../../src/modules/product-management/index.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import {
  MemoryProductImpactChecker,
  MemoryProductReferenceReader,
  MemoryProductRepository,
  MemoryUnitOfWork,
} from '../../helpers/MemoryProductRepository.js';
import { createUser } from '../../helpers/createUser.js';

const security = {
  secret: 'test-only-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const body = (overrides = {}) => ({
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
  body({
    name: 'Mozzarella Cheese',
    description: 'Cheese component',
    isSellable: false,
    isPizzaComponent: true,
    acquisitionType: 'PRODUCED',
    pizzaComponentTypeId: 'type-03',
    allergenIds: [7],
    pricingMode: null,
    basePrice: null,
    ...overrides,
  });
const pizza = (compositionItems, overrides = {}) =>
  body({
    name: 'Margherita',
    description: 'Pizza composed from products',
    acquisitionType: 'PRODUCED',
    compositionItems,
    pricingMode: 'COMPONENT_BASED',
    basePrice: null,
    ...overrides,
  });

let app, products, impact, manager, employee, customer, administrator, adminManager;

async function tokenFor(userModule, users, roles, email) {
  const user = createUser({
    name: 'Test',
    email,
    passwordHash: await userModule.hasher.hash('long-password'),
    roles,
  });
  await users.save(user);
  return userModule.tokens.generateToken({
    sub: user.getId().getValue(),
    email,
    roles: user.getRoles(),
  });
}

beforeEach(async () => {
  const users = new MemoryUserRepository();
  products = new MemoryProductRepository();
  impact = new MemoryProductImpactChecker();
  const references = new MemoryProductReferenceReader();
  references.productRepository = products;
  const userModule = createUserModule({ repository: users, security });
  const productModule = createProductManagementModule({
    userService: userModule.userService,
    repository: products,
    referenceReader: references,
    impactChecker: impact,
    unitOfWork: new MemoryUnitOfWork(products),
  });
  app = createApp({ userModule, productModule });
  manager = await tokenFor(userModule, users, ['MANAGER'], 'm@example.com');
  employee = await tokenFor(userModule, users, ['EMPLOYEE'], 'e@example.com');
  customer = await tokenFor(userModule, users, ['CUSTOMER'], 'c@example.com');
  administrator = await tokenFor(
    userModule,
    users,
    ['ADMINISTRATOR'],
    'a@example.com',
  );
  adminManager = await tokenFor(
    userModule,
    users,
    ['ADMINISTRATOR', 'MANAGER'],
    'am@example.com',
  );
});

const create = (payload = body(), token = manager) =>
  request(app).post('/api/v1/products').set(auth(token)).send(payload);

describe('BCK05 HTTP contract', () => {
  test('Manager creates a product and receives its resource location', async () => {
    const response = await create();
    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/products/PROD-00001');
    expect(response.body).toMatchObject({
      id: 'PROD-00001',
      isActive: true,
      isSellable: true,
      acquisitionType: 'PURCHASED',
      compositionItems: [],
    });
    expect(response.body).not.toHaveProperty('isStockControlled');
    expect(response.body).not.toHaveProperty('initialUnits');
  });

  test('creates and searches a pizza, summing repeated child product quantities', async () => {
    const child = await create(component());
    expect(child.status).toBe(201);
    const created = await create(
      pizza([
        { productId: child.body.id, quantity: 2 },
        { productId: child.body.id, quantity: 3 },
      ]),
    );
    expect(created.status).toBe(201);
    expect(created.body.compositionItems).toEqual([
      { productId: child.body.id, quantity: 5 },
    ]);
    const found = await request(app)
      .get(`/api/v1/products/${created.body.id}`)
      .set(auth(employee));
    expect(found.status).toBe(200);
    expect(found.body.compositionItems).toEqual(created.body.compositionItems);
    const search = await request(app)
      .get('/api/v1/products?acquisitionType=PRODUCED&isSellable=true')
      .set(auth(employee));
    expect(search.status).toBe(200);
    expect(search.body.map((item) => item.id)).toContain(created.body.id);
  });

  test('rejects invalid product data and unknown references', async () => {
    for (const payload of [
      { ...body(), isActive: false },
      { ...body(), initialUnits: 4 },
      body({ isSellable: false, isPizzaComponent: false }),
      body({ isSellable: true, pricingMode: 'FIXED', basePrice: 1.999 }),
      body({ compositionItems: [{ productId: 'PROD-00001', quantity: 0 }] }),
    ])
      expect((await create(payload)).status).toBe(400);
    expect((await create(body({ categoryId: 'CAT-00099' }))).status).toBe(404);
    expect(products.rows.size).toBe(0);
  });

  test('rejects a composition cycle with 409', async () => {
    const first = await create(pizza([]));
    const second = await create(pizza([{ productId: first.body.id, quantity: 1 }], { name: 'Second pizza' }));
    const response = await request(app)
      .put(`/api/v1/products/${first.body.id}`)
      .set(auth(manager))
      .send(pizza([{ productId: second.body.id, quantity: 1 }], {
        expectedUpdatedAt: first.body.updatedAt,
      }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(response.status).toBe(409);
  });

  test('requires authentication and limits mutations to Managers', async () => {
    expect((await request(app).post('/api/v1/products').send(body())).status).toBe(401);
    expect((await create(body(), customer)).status).toBe(403);
    expect((await create(body(), employee)).status).toBe(403);
    const created = await create();
    const url = `/api/v1/products/${created.body.id}`;
    expect((await request(app).get(url).set(auth(employee))).status).toBe(200);
    expect((await request(app).delete(url).set(auth(employee))).status).toBe(403);
  });

  test('excluding an allergen also excludes products that only have it in their composition', async () => {
    const child = await create(component());
    const created = await create(
      pizza([{ productId: child.body.id, quantity: 1 }]),
    );
    expect(created.status).toBe(201);
    const search = await request(app)
      .get('/api/v1/products?excludeAllergenIds=7')
      .set(auth(manager));
    expect(search.status).toBe(200);
    const ids = search.body.map((item) => item.id);
    expect(ids).not.toContain(child.body.id);
    expect(ids).not.toContain(created.body.id);
  });

  test('public reads expose only active sellable data while staff retain the full view', async () => {
    const child = await create(component());
    const created = await create(
      pizza([{ productId: child.body.id, quantity: 2 }]),
    );
    expect(child.status).toBe(201);
    expect(created.status).toBe(201);

    const publicList = await request(app).get('/api/v1/products');
    expect(publicList.status).toBe(200);
    expect(publicList.body.map((item) => item.id)).toEqual([created.body.id]);
    expect(publicList.body[0]).toMatchObject({
      id: created.body.id,
      name: 'Margherita',
      allergenIds: [],
      pricingMode: 'COMPONENT_BASED',
      basePrice: null,
    });
    for (const field of [
      'acquisitionType',
      'compositionItems',
      'isPizzaComponent',
      'isActive',
      'createdAt',
      'updatedAt',
    ])
      expect(publicList.body[0]).not.toHaveProperty(field);

    const publicDetail = await request(app).get(
      `/api/v1/products/${created.body.id}`,
    );
    expect(publicDetail.status).toBe(200);
    expect(publicDetail.body).toEqual(publicList.body[0]);
    expect(
      (await request(app).get(`/api/v1/products/${child.body.id}`)).status,
    ).toBe(404);

    // Customers and Administrators without a staff role get the public view.
    for (const token of [customer, administrator]) {
      const list = await request(app)
        .get('/api/v1/products')
        .set(auth(token));
      expect(list.body.map((item) => item.id)).toEqual([created.body.id]);
      expect(list.body[0]).not.toHaveProperty('compositionItems');
      expect(
        (
          await request(app)
            .get(`/api/v1/products/${child.body.id}`)
            .set(auth(token))
        ).status,
      ).toBe(404);
      const detail = await request(app)
        .get(`/api/v1/products/${created.body.id}`)
        .set(auth(token));
      expect(detail.body).toEqual(publicList.body[0]);
    }

    // MANAGER / EMPLOYEE (also combined with ADMINISTRATOR) keep the full view.
    for (const token of [manager, employee, adminManager]) {
      const list = await request(app)
        .get('/api/v1/products')
        .set(auth(token));
      const detail = await request(app)
        .get(`/api/v1/products/${child.body.id}`)
        .set(auth(token));
      expect(list.body.map((item) => item.id)).toContain(child.body.id);
      expect(detail.body).toMatchObject({
        id: child.body.id,
        acquisitionType: 'PRODUCED',
        compositionItems: [],
        allergenIds: [7],
      });
    }
  });

  test('public searches ignore internal filters such as acquisitionType', async () => {
    const child = await create(component());
    const created = await create(
      pizza([{ productId: child.body.id, quantity: 2 }]),
    );
    expect(created.status).toBe(201);

    const baseline = await request(app).get('/api/v1/products');
    expect(baseline.body.map((item) => item.id)).toEqual([created.body.id]);

    // The pizza is PRODUCED: if the filter were applied, these would hide it
    // or reveal internal data. Public callers must get the same result.
    for (const query of [
      'acquisitionType=PURCHASED',
      'acquisitionType=PRODUCED',
      'isPizzaComponent=true',
      'isActive=false',
      'isSellable=false',
    ]) {
      const response = await request(app).get(`/api/v1/products?${query}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(baseline.body);
    }

    // Staff searches still apply the internal filter.
    const staff = await request(app)
      .get('/api/v1/products?acquisitionType=PURCHASED')
      .set(auth(manager));
    expect(staff.body.map((item) => item.id)).not.toContain(created.body.id);
  });

  test('PUT replaces editable state; DELETE and PATCH deactivate/reactivate', async () => {
    const created = await create();
    const url = `/api/v1/products/${created.body.id}`;
    const updated = await request(app)
      .put(url)
      .set(auth(manager))
      .send(body({
        name: 'Coke Zero',
        basePrice: 2,
        expectedUpdatedAt: created.body.updatedAt,
      }));
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: 'Coke Zero', basePrice: 2 });
    expect((await request(app).delete(url).set(auth(manager))).status).toBe(204);
    expect((await request(app).get(url).set(auth(employee))).body.isActive).toBe(false);
    const activated = await request(app).patch(`${url}/activate`).set(auth(manager));
    expect(activated.status).toBe(200);
    expect(activated.body.isActive).toBe(true);
  });

  test('rejects stale product edits and leaves the latest version unchanged', async () => {
    const created = await create();
    const url = `/api/v1/products/${created.body.id}`;
    const originalVersion = created.body.updatedAt;
    const firstEdit = await request(app)
      .put(url)
      .set(auth(manager))
      .send(body({ name: 'First edit', expectedUpdatedAt: originalVersion }));
    expect(firstEdit.status).toBe(200);

    const staleEdit = await request(app)
      .put(url)
      .set(auth(manager))
      .send(body({ name: 'Stale edit', expectedUpdatedAt: originalVersion }));
    expect(staleEdit.status).toBe(412);
    expect((await request(app).get(url).set(auth(manager))).body.name).toBe(
      'First edit',
    );
  });

  test('returns 409 when an update removes a referenced component role', async () => {
    const created = await create(component());
    impact.components.add(created.body.id);
    const response = await request(app)
      .put(`/api/v1/products/${created.body.id}`)
      .set(auth(manager))
      .send(body({
        name: created.body.name,
        expectedUpdatedAt: created.body.updatedAt,
      }));
    expect(response.status).toBe(409);
  });
});