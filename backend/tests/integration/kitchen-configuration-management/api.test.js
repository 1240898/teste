import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createKitchenConfigurationModule } from '../../../src/modules/kitchen-configuration-management/index.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { createUser } from '../../helpers/createUser.js';
import {
  MemoryKitchenAssetCatalogue,
  MemoryKitchenAssetFileStore,
  MemoryKitchenConfigurationRepository,
  MemoryKitchenUnitOfWork,
  sample,
} from '../../helpers/kitchenConfigurationFixtures.js';

const security = {
  secret: 'test-only-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const BASE = '/api/v1/kitchen-configurations';

let app, files, tokens;

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
  const repository = new MemoryKitchenConfigurationRepository();
  files = new MemoryKitchenAssetFileStore();
  const userModule = createUserModule({ repository: users, security });
  const kitchenConfigurationModule = createKitchenConfigurationModule({
    userService: userModule.userService,
    repository,
    assetCatalogue: new MemoryKitchenAssetCatalogue(),
    assetFiles: files,
    unitOfWork: new MemoryKitchenUnitOfWork(repository),
    assetsPublicUrl: 'http://localhost:8080/api/v1/kitchen-assets/files',
  });
  app = createApp({ userModule, kitchenConfigurationModule });
  tokens = {
    MANAGER: await tokenFor(userModule, users, ['MANAGER'], 'm@example.com'),
    EMPLOYEE: await tokenFor(userModule, users, ['EMPLOYEE'], 'e@example.com'),
    CUSTOMER: await tokenFor(userModule, users, ['CUSTOMER'], 'c@example.com'),
    ADMINISTRATOR: await tokenFor(
      userModule,
      users,
      ['ADMINISTRATOR'],
      'a@example.com',
    ),
  };
});

const create = (name, content = sample('compact'), token = tokens.MANAGER) =>
  request(app).post(BASE).set(auth(token)).send({ name, content });
const activate = (id, token = tokens.MANAGER) =>
  request(app).post(`${BASE}/${id}/activation`).set(auth(token));

describe('WEB06 HTTP contract', () => {
  test('IT01 - roles: MANAGER manages, MANAGER/EMPLOYEE read the active one', async () => {
    const endpoints = [
      ['get', BASE],
      ['get', `${BASE}/KCF-00001`],
      ['post', BASE],
      ['post', `${BASE}/validation`],
      ['put', `${BASE}/KCF-00001`],
      ['delete', `${BASE}/KCF-00001`],
      ['post', `${BASE}/KCF-00001/activation`],
      ['get', '/api/v1/kitchen-assets'],
    ];
    for (const [method, url] of endpoints) {
      expect((await request(app)[method](url)).status).toBe(401);
      for (const role of ['EMPLOYEE', 'CUSTOMER', 'ADMINISTRATOR'])
        expect(
          (await request(app)[method](url).set(auth(tokens[role]))).status,
        ).toBe(403);
    }
    expect((await request(app).get(`${BASE}/active`)).status).toBe(401);
    for (const role of ['CUSTOMER', 'ADMINISTRATOR'])
      expect(
        (await request(app).get(`${BASE}/active`).set(auth(tokens[role])))
          .status,
      ).toBe(403);
    for (const role of ['MANAGER', 'EMPLOYEE'])
      expect(
        (await request(app).get(`${BASE}/active`).set(auth(tokens[role])))
          .status,
      ).toBe(404);
    expect(
      (await request(app).get(BASE).set(auth(tokens.MANAGER))).status,
    ).toBe(200);
  });

  test('IT02 - create, duplicate name, invalid content, too large, malformed', async () => {
    const created = await create('Compact kitchen');
    expect(created.status).toBe(201);
    expect(created.headers.location).toBe(`${BASE}/KCF-00001`);
    expect(created.body).toMatchObject({
      id: 'KCF-00001',
      status: 'INACTIVE',
      version: 1,
    });
    expect((await create('COMPACT KITCHEN')).status).toBe(409);
    const invalid = await create('Broken', sample('invalid'));
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.details.length).toBeGreaterThan(3);
    const huge = await create('Huge', {
      ...sample('compact'),
      padding: 'x'.repeat(110 * 1024),
    });
    expect(huge.status).toBe(413);
    const malformed = await request(app)
      .post(BASE)
      .set(auth(tokens.MANAGER))
      .set('Content-Type', 'application/json')
      .send('{"name": "x",');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.message).toBe('Invalid JSON body');
    expect((await create('ab')).status).toBe(400);
  });

  test('IT03 - stale version and invalid edit of the active configuration', async () => {
    const { body } = await create('Compact kitchen');
    await activate(body.id);
    const ok = await request(app)
      .put(`${BASE}/${body.id}`)
      .set(auth(tokens.MANAGER))
      .send({ name: 'Kitchen B', content: sample('compact'), version: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body.version).toBe(2);
    const stale = await request(app)
      .put(`${BASE}/${body.id}`)
      .set(auth(tokens.MANAGER))
      .send({ name: 'Kitchen C', content: sample('compact'), version: 1 });
    expect(stale.status).toBe(409);
    const invalid = await request(app)
      .put(`${BASE}/${body.id}`)
      .set(auth(tokens.MANAGER))
      .send({ name: 'Kitchen B', content: sample('invalid'), version: 2 });
    expect(invalid.status).toBe(422);
    const active = await request(app)
      .get(`${BASE}/active`)
      .set(auth(tokens.EMPLOYEE));
    expect(active.body).toMatchObject({
      id: body.id,
      version: 2,
      content: sample('compact'),
    });
  });

  test('IT04 - delete active (409), inactive (204), unknown (404), bad id (400)', async () => {
    const first = (await create('Compact kitchen')).body;
    const second = (await create('Extended kitchen', sample('extended'))).body;
    await activate(first.id);
    const del = (id) =>
      request(app).delete(`${BASE}/${id}`).set(auth(tokens.MANAGER));
    expect((await del(first.id)).status).toBe(409);
    expect((await del(second.id)).status).toBe(204);
    expect((await del('KCF-00099')).status).toBe(404);
    expect((await del('oops')).status).toBe(400);
  });

test('IT05 - active endpoint: 404 NO_ACTIVE_CONFIGURATION, then resolved absolute asset URLs', async () => {
    const none = await request(app)
      .get(`${BASE}/active`)
      .set(auth(tokens.EMPLOYEE));
    expect(none.status).toBe(404);
    expect(none.body).toEqual({
      error: {
        message: 'No active kitchen configuration',
        status: 404,
        details: [
          {
            path: '',
            code: 'NO_ACTIVE_CONFIGURATION',
            message: 'No active kitchen configuration',
          },
        ],
      },
    });
    const unknownRoute = await request(app)
      .get('/api/v1/kitchen-configuration/active')
      .set(auth(tokens.EMPLOYEE));
    expect(unknownRoute.status).toBe(404);
    expect(unknownRoute.body.error?.details).toBeUndefined();
    const { body } = await create('Extended kitchen', sample('extended'));

    const activation = await activate(body.id);
    expect(activation.status).toBe(200);
    expect(activation.body).toMatchObject({
      activeConfiguration: { id: body.id, status: 'ACTIVE' },
      previousActiveConfigurationId: null,
    });
    const active = await request(app)
      .get(`${BASE}/active`)
      .set(auth(tokens.EMPLOYEE));
    expect(active.status).toBe(200);
    expect(active.headers['cache-control']).toBe('no-store');
    expect(active.body.assets['AST-MDL-TABLE-PLAIN-01']).toEqual({
      kind: 'MODEL',
      format: 'glb',
      url: 'http://localhost:8080/api/v1/kitchen-assets/files/models/table-plain-01.glb',
    });
    expect(active.body.assets['AST-TEX-PLASTER-COLOR']).toBeDefined();
  });

  test('IT06 - dry-run validation stores nothing', async () => {
    const valid = await request(app)
      .post(`${BASE}/validation`)
      .set(auth(tokens.MANAGER))
      .send({ content: sample('compact') });
    expect(valid.body).toEqual({ valid: true, issues: [] });
    const invalid = await request(app)
      .post(`${BASE}/validation`)
      .set(auth(tokens.MANAGER))
      .send({ content: sample('invalid') });
    expect(invalid.status).toBe(200);
    expect(invalid.body.valid).toBe(false);
    expect(
      (await request(app).get(BASE).set(auth(tokens.MANAGER))).body,
    ).toEqual([]);
  });

  test('IT11 - the invalid sample is rejected with every documented code', async () => {
    const response = await create('Invalid kitchen', sample('invalid'));
    expect(response.status).toBe(422);
    expect(response.body.error.message).toBe(
      'The kitchen configuration content is invalid',
    );
    expect(response.body.error.details.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'LINE_COMPOSITION',
        'INCOMPLETE_TEXTURE_SET',
        'UNKNOWN_ASSET',
        'LINE_BELT_DISCONNECTED',
        'MODEL_TEXTURES_MISSING',
      ]),
    );
  });

  test('IT12 - a missing model file blocks activation and keeps the active one', async () => {
    const first = (await create('Compact kitchen')).body;
    const second = (await create('Extended kitchen', sample('extended'))).body;
    await activate(first.id);
    files.missing.add('models/conveyor-01.glb');
    for (const id of [first.id, second.id]) {
      const response = await activate(id);
      expect(response.status).toBe(422);
      expect(response.body.error.details.map((issue) => issue.code)).toContain(
        'ASSET_FILE_MISSING',
      );
    }
    const active = await request(app)
      .get(`${BASE}/active`)
      .set(auth(tokens.MANAGER));
    expect(active.body).toMatchObject({ id: first.id, status: 'ACTIVE' });
  });

  test('asset catalogue lists sizes and embeddedTextureSet for models', async () => {
    const response = await request(app)
      .get('/api/v1/kitchen-assets')
      .set(auth(tokens.MANAGER));
    expect(response.status).toBe(200);
    expect(
      response.body.find((asset) => asset.id === 'AST-MDL-TABLE-PLAIN-01'),
    ).toMatchObject({
      kind: 'MODEL',
      size: { x: 1.6, y: 0.9, z: 0.8 },
      embeddedTextureSet: false,
    });
    expect(
      response.body.find((asset) => asset.kind === 'TEXTURE').size,
    ).toBeUndefined();
  });

  test('static asset files are public and read-only', async () => {
    const file = await request(app).get(
      '/api/v1/kitchen-assets/files/models/conveyor-01.glb',
    );
    expect(file.status).toBe(200);
    expect(file.headers['cache-control']).toBe('public, max-age=300');
    expect(
      (await request(app).get('/api/v1/kitchen-assets/files/models/nope.glb'))
        .status,
    ).toBe(404);
    expect(
      (
        await request(app).get(
          '/api/v1/kitchen-assets/files/../../package.json',
        )
      ).status,
    ).toBe(404);
  });
});