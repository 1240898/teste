import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createProductCategoryModule } from '../../../src/modules/product-category-management/index.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { MemoryProductCategoryRepository } from '../../helpers/MemoryProductCategoryRepository.js';
import { createUser } from '../../helpers/createUser.js';

const security = {
  secret: 'test-only-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
let app, categories, managerToken, customerToken;

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
  categories = new MemoryProductCategoryRepository();
  const userModule = createUserModule({ repository: users, security });
  const categoryModule = createProductCategoryModule({
    repository: categories,
    userService: userModule.userService,
  });
  app = createApp({ userModule, categoryModule });
  managerToken = await tokenFor(
    userModule,
    users,
    ['MANAGER'],
    'm@example.com',
  );
  customerToken = await tokenFor(
    userModule,
    users,
    ['CUSTOMER'],
    'c@example.com',
  );
});
const create = (name, token = managerToken) =>
  request(app).post('/api/v1/categories').set(auth(token)).send({ name });

describe('BCK03 HTTP contract (real security, in-memory persistence)', () => {
  test('IT01 POST creates a category (201, Location, body)', async () => {
    const res = await create('Beverages');
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/v1/categories/CAT-00001');
    expect(res.body).toMatchObject({ id: 'CAT-00001', name: 'Beverages' });
    expect(Object.keys(res.body).sort()).toEqual([
      'createdAt',
      'id',
      'name',
      'updatedAt',
    ]);
    expect(categories.rows.size).toBe(1);
  });
  test('IT02 write operations require authentication (401) and the MANAGER role (403)', async () => {
    const { body } = await create('Pizzas');
    const url = `/api/v1/categories/${body.id}`;
    for (const [method, path] of [
      ['post', '/api/v1/categories'],
      ['put', url],
      ['delete', url],
    ]) {
      expect(
        (await request(app)[method](path).send({ name: 'X' })).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            [method](path)
            .set(auth(customerToken))
            .send({ name: 'X' })
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await request(app)
          .post('/api/v1/categories')
          .set(auth('garbage'))
          .send({ name: 'X' })
      ).status,
    ).toBe(401);
    expect(categories.rows.size).toBe(1);
    expect(categories.rows.get(body.id).name).toBe('Pizzas');
  });
  test('GET endpoints are public (BR2)', async () => {
    await create('Pizzas');
    const list = await request(app).get('/api/v1/categories');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(
      (await request(app).get('/api/v1/categories/CAT-00001')).body.name,
    ).toBe('Pizzas');
  });
  test('IT04 GET ?name= and ?id= filter the listing', async () => {
    await create('Pizzas');
    await create('Soft Drinks');
    const byName = await request(app).get('/api/v1/categories?name=pizz');
    expect(byName.status).toBe(200);
    expect(byName.body.map((c) => c.name)).toEqual(['Pizzas']);
    const byId = await request(app).get('/api/v1/categories?id=CAT-00002');
    expect(byId.body.map((c) => c.name)).toEqual(['Soft Drinks']);
    expect(
      (await request(app).get('/api/v1/categories?name=zzz')).body,
    ).toEqual([]);
    expect(
      (await request(app).get('/api/v1/categories?name=a&name=b')).status,
    ).toBe(400);
  });
  test('GET by id: 404 for unknown, 400 for malformed', async () => {
    const missing = await request(app).get('/api/v1/categories/CAT-00099');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      error: { message: 'Category not found', status: 404 },
    });
    expect((await request(app).get('/api/v1/categories/abc')).status).toBe(400);
  });
  test('POST validation: 400 for empty/blank/missing/unknown/non-string, specific message for empty', async () => {
    const empty = await create('   ');
    expect(empty.status).toBe(400);
    expect(empty.body.error.message).toBe('Category name cannot be empty');
    for (const body of [
      {},
      { name: 5 },
      { name: null },
      { name: 'X', extra: 1 },
      [],
    ])
      expect(
        (
          await request(app)
            .post('/api/v1/categories')
            .set(auth(managerToken))
            .send(body)
        ).status,
      ).toBe(400);
    expect(categories.rows.size).toBe(0);
  });
  test('POST duplicate name (case-insensitive) returns 409', async () => {
    await create('Pizzas');
    const res = await create('pIZZAS');
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Category name already exists');
  });
  test('PUT renames (200), conflicts (409), and reports unknown ids (404)', async () => {
    await create('Drinks');
    await create('Pizzas');
    const ok = await request(app)
      .put('/api/v1/categories/CAT-00001')
      .set(auth(managerToken))
      .send({ name: 'Beverages' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: 'CAT-00001', name: 'Beverages' });
    const clash = await request(app)
      .put('/api/v1/categories/CAT-00001')
      .set(auth(managerToken))
      .send({ name: 'PIZZAS' });
    expect(clash.status).toBe(409);
    const missing = await request(app)
      .put('/api/v1/categories/CAT-00077')
      .set(auth(managerToken))
      .send({ name: 'X' });
    expect(missing.status).toBe(404);
  });
  test('DELETE removes an unreferenced category (204) and then 404s', async () => {
    await create('Pizzas');
    const del = await request(app)
      .delete('/api/v1/categories/CAT-00001')
      .set(auth(managerToken));
    expect(del.status).toBe(204);
    expect(del.text).toBe('');
    expect(
      (await request(app).get('/api/v1/categories/CAT-00001')).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete('/api/v1/categories/CAT-00001')
          .set(auth(managerToken))
      ).status,
    ).toBe(404);
  });
  test('IT03 DELETE of a category referenced by products returns 409 and keeps it', async () => {
    await create('Pizzas');
    categories.referencedIds.add('CAT-00001');
    const res = await request(app)
      .delete('/api/v1/categories/CAT-00001')
      .set(auth(managerToken));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/referenced by existing products/i);
    expect(categories.rows.has('CAT-00001')).toBe(true);
  });
  test('unexpected failures return a generic 500 without internals', async () => {
    categories.findAll = async () => {
      throw new Error('connection to db-host:5432 refused');
    };
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/db-host|5432/);
  });
  test('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set(auth(managerToken))
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(res.status).toBe(400);
  });
});
