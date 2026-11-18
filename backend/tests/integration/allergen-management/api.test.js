import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createAllergenModule } from '../../../src/modules/allergen-management/index.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { MemoryAllergenRepository } from '../../helpers/MemoryAllergenRepository.js';
import { createUser } from '../../helpers/createUser.js';

const security = {
  secret: 'test-only-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
let app, allergens, managerToken, customerToken;

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
  allergens = new MemoryAllergenRepository();
  const userModule = createUserModule({ repository: users, security });
  const allergenModule = createAllergenModule({
    repository: allergens,
    userService: userModule.userService,
  });
  app = createApp({ userModule, allergenModule });
  managerToken = await tokenFor(userModule, users, ['MANAGER'], 'm@example.com');
  customerToken = await tokenFor(
    userModule,
    users,
    ['CUSTOMER'],
    'c@example.com',
  );
});
const register = (id, name, token = managerToken) =>
  request(app).post('/api/v1/allergens').set(auth(token)).send({ id, name });

describe('BCK04 HTTP contract (real security, in-memory persistence)', () => {
  test('IT01 POST registers an allergen (201, Location, body)', async () => {
    const res = await register(1, 'Gluten');
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/v1/allergens/1');
    expect(res.body).toMatchObject({ id: 1, name: 'Gluten' });
    expect(Object.keys(res.body).sort()).toEqual([
      'createdAt',
      'id',
      'name',
      'updatedAt',
    ]);
    expect(allergens.rows.size).toBe(1);
  });
  test('IT02 write operations require authentication (401) and the MANAGER role (403)', async () => {
    await register(1, 'Gluten');
    for (const [method, path, body] of [
      ['post', '/api/v1/allergens', { id: 2, name: 'X' }],
      ['put', '/api/v1/allergens/1', { name: 'X' }],
      ['delete', '/api/v1/allergens/1', undefined],
    ]) {
      expect((await request(app)[method](path).send(body)).status).toBe(401);
      expect(
        (await request(app)[method](path).set(auth(customerToken)).send(body))
          .status,
      ).toBe(403);
    }
    expect((await register(2, 'X', 'garbage')).status).toBe(401);
    expect(allergens.rows.size).toBe(1);
    expect(allergens.rows.get(1).name).toBe('Gluten');
  });
  test('GET endpoints are public (BR2)', async () => {
    await register(1, 'Gluten');
    const list = await request(app).get('/api/v1/allergens');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect((await request(app).get('/api/v1/allergens/1')).body.name).toBe(
      'Gluten',
    );
  });
  test('IT04 GET ?name= and ?id= filter the listing', async () => {
    await register(1, 'Gluten');
    await register(5, 'Peanuts');
    await register(8, 'Tree Nuts');
    const byName = await request(app).get('/api/v1/allergens?name=Gluten');
    expect(byName.status).toBe(200);
    expect(byName.body.map((a) => a.name)).toEqual(['Gluten']);
    expect(
      (await request(app).get('/api/v1/allergens?name=nuts')).body.map(
        (a) => a.id,
      ),
    ).toEqual([5, 8]);
    const byId = await request(app).get('/api/v1/allergens?id=5');
    expect(byId.body.map((a) => a.name)).toEqual(['Peanuts']);
    expect((await request(app).get('/api/v1/allergens?name=zzz')).body).toEqual(
      [],
    );
    expect(
      (await request(app).get('/api/v1/allergens?name=a&name=b')).status,
    ).toBe(400);
    expect((await request(app).get('/api/v1/allergens?id=99')).status).toBe(
      400,
    );
  });
  test('GET by id: 404 for unknown, 400 for malformed or out of range', async () => {
    const missing = await request(app).get('/api/v1/allergens/4');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      error: { message: 'Allergen not found', status: 404 },
    });
    expect((await request(app).get('/api/v1/allergens/abc')).status).toBe(400);
    expect((await request(app).get('/api/v1/allergens/15')).status).toBe(400);
  });
  test('POST validation: 400 for empty/missing/unknown/wrongly-typed fields, specific messages', async () => {
    const empty = await register(1, '   ');
    expect(empty.status).toBe(400);
    expect(empty.body.error.message).toBe('Allergen name cannot be empty');
    const outOfRange = await register(15, 'Something');
    expect(outOfRange.status).toBe(400);
    expect(outOfRange.body.error.message).toMatch(/between 1 and 14/);
    for (const body of [
      {},
      { name: 'Gluten' },
      { id: 1 },
      { id: '1', name: 'Gluten' },
      { id: 1, name: 5 },
      { id: 1, name: 'Gluten', extra: true },
      [],
    ])
      expect(
        (
          await request(app)
            .post('/api/v1/allergens')
            .set(auth(managerToken))
            .send(body)
        ).status,
      ).toBe(400);
    expect(allergens.rows.size).toBe(0);
  });
  test('POST duplicate name (case-insensitive) or id returns 409', async () => {
    await register(1, 'Gluten');
    const sameName = await register(2, 'gLUTEN');
    expect(sameName.status).toBe(409);
    expect(sameName.body.error.message).toBe('Allergen name already exists');
    const sameId = await register(1, 'Wheat');
    expect(sameId.status).toBe(409);
    expect(sameId.body.error.message).toBe('Allergen id already exists');
  });
  test('PUT renames (200), conflicts (409), and reports unknown ids (404)', async () => {
    await register(7, 'Milk');
    await register(3, 'Eggs');
    const ok = await request(app)
      .put('/api/v1/allergens/7')
      .set(auth(managerToken))
      .send({ name: 'Lactose' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: 7, name: 'Lactose' });
    const clash = await request(app)
      .put('/api/v1/allergens/7')
      .set(auth(managerToken))
      .send({ name: 'EGGS' });
    expect(clash.status).toBe(409);
    const missing = await request(app)
      .put('/api/v1/allergens/4')
      .set(auth(managerToken))
      .send({ name: 'Fish' });
    expect(missing.status).toBe(404);
    const unknownField = await request(app)
      .put('/api/v1/allergens/7')
      .set(auth(managerToken))
      .send({ id: 8, name: 'Nuts' });
    expect(unknownField.status).toBe(400);
  });
  test('DELETE removes an unreferenced allergen (204) and then 404s', async () => {
    await register(1, 'Gluten');
    const del = await request(app)
      .delete('/api/v1/allergens/1')
      .set(auth(managerToken));
    expect(del.status).toBe(204);
    expect(del.text).toBe('');
    expect((await request(app).get('/api/v1/allergens/1')).status).toBe(404);
    expect(
      (await request(app).delete('/api/v1/allergens/1').set(auth(managerToken)))
        .status,
    ).toBe(404);
  });
  test('IT03 DELETE of a referenced allergen returns 409 and keeps it', async () => {
    await register(1, 'Gluten');
    allergens.referencedIds.add(1);
    const res = await request(app)
      .delete('/api/v1/allergens/1')
      .set(auth(managerToken));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(
      /referenced by existing business information/i,
    );
    expect(allergens.rows.has(1)).toBe(true);
  });
  test('unexpected failures return a generic 500 without internals', async () => {
    allergens.findAll = async () => {
      throw new Error('connection to db-host:5432 refused');
    };
    const res = await request(app).get('/api/v1/allergens');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/db-host|5432/);
  });
  test('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/v1/allergens')
      .set(auth(managerToken))
      .set('Content-Type', 'application/json')
      .send('{"id":');
    expect(res.status).toBe(400);
  });
});