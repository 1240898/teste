import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createUser } from '../../helpers/createUser.js';
import { AuthMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/authMiddleware.js';
import { ExternalIdentityClaims } from '../../../src/modules/user-authentication-management/application/dtos/ExternalIdentityClaims.js';
import { UserId } from '../../../src/modules/user-authentication-management/domain/model/values.js';
import { createStockModule } from '../../../src/modules/stock-information-management/index.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import {
  MemoryStockQueryRepository,
  MemoryStockRepository,
  MemoryStockUnitOfWork,
} from '../../helpers/MemoryStockRepository.js';

const security = {
  secret: 'aa02-test-secret-at-least-thirty-two-bytes!',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const silent = { warn: () => {} };

// Test double for Google: no network; the code "valid-code" is the only accepted one.
function fakeGoogle(subject = 'google-subject-1') {
  let counter = 0;
  return {
    provider: 'GOOGLE',
    async createAuthorizationRequest() {
      counter += 1;
      const state = `state-${counter}-abcdefghijklmnop`;
      return {
        authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
        state,
        nonce: `nonce-${counter}`,
        codeVerifier: `verifier-${counter}`,
      };
    },
    async exchangeAndVerify(code) {
      if (code !== 'valid-code') throw new Error('code exchange failed');
      return new ExternalIdentityClaims({
        provider: 'GOOGLE',
        subject,
        email: 'ana.silva@gmail.com',
        emailVerified: true,
        name: 'Ana Silva',
      });
    },
  };
}

function build({ identityProvider = fakeGoogle(), rateLimit } = {}) {
  const repository = new MemoryUserRepository();
  const userModule = createUserModule({
    repository,
    security,
    identityProvider,
    rateLimit,
    logger: silent,
  });
  const stockRepository = new MemoryStockRepository();
  const stockModule = createStockModule({
    repository: stockRepository,
    queryRepository: new MemoryStockQueryRepository(stockRepository, new Map()),
    productReader: { getStockControlStatusForUpdate: async () => null },
    unitOfWork: new MemoryStockUnitOfWork(),
    authMiddleware: new AuthMiddleware(userModule.userService),
  });
  return { app: createApp({ userModule, stockModule }), repository };
}

async function signIn(app, code = 'valid-code') {
  const started = await request(app).post('/api/v1/auth/google/authorization');
  return request(app)
    .post('/api/v1/auth/google/callback')
    .send({ code, state: started.body.state });
}

describe('AA02 Google sign-in HTTP contract (fake provider, in-memory persistence)', () => {
  test('IT01 starts the authorization with no-store caching', async () => {
    const { app } = build();
    const response = await request(app).post(
      '/api/v1/auth/google/authorization',
    );
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      authorizationUrl: expect.stringMatching(
        /^https:\/\/accounts\.google\.com\//,
      ),
      state: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toMatch(/verifier|nonce/);
  });

  test('IT02 issues a CUSTOMER token; roles are resolved internally per request', async () => {
    const { app, repository } = build();
    const response = await signIn(app);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: '1d',
      hasLocalCredential: false,
      user: {
        email: 'ana.silva@gmail.com',
        roles: ['CUSTOMER'],
        active: true,
        marketingConsent: false,
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password|hash/i);
    const token = response.body.accessToken;
    const change = await request(app)
      .patch('/api/v1/auth/password')
      .set(auth(token))
      .send({
        currentPassword: 'CurrentSecure123!',
        newPassword: 'DifferentSecure456!',
      });
    expect(change.status).toBe(422);
    // Customer has no access to internal stock (Table 1).
    expect(
      (await request(app).get('/api/v1/stock').set(auth(token))).status,
    ).toBe(403);
    // Promote through a test fixture (independent of AA06); same token, no new sign-in.
    const user = await repository.findById(
      UserId.create(response.body.user.id),
    );
    user.setRoles(['MANAGER']);
    await repository.save(user);
    expect(
      (await request(app).get('/api/v1/stock').set(auth(token))).status,
    ).toBe(200);
  });

  test('IT02 a second sign-in reuses the same account', async () => {
    const { app, repository } = build();
    const first = await signIn(app);
    const second = await signIn(app);
    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(repository.users.size).toBe(1);
  });

  test('IT03 invalid payload, unknown state and replayed callback are rejected', async () => {
    const { app } = build();
    for (const body of [
      {},
      { code: 'valid-code' },
      { code: 'valid-code', state: 'short' },
      { code: 'valid-code', state: 'has spaces in the state value' },
      {
        code: 'valid-code',
        state: 'state-1-abcdefghijklmnop',
        roles: ['MANAGER'],
      },
    ]) {
      const response = await request(app)
        .post('/api/v1/auth/google/callback')
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: { message: 'Invalid request body', status: 400 },
      });
    }
    const unknown = await request(app)
      .post('/api/v1/auth/google/callback')
      .send({ code: 'valid-code', state: 'never-issued-state-value' });
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual({
      error: { message: 'External authentication failed', status: 401 },
    });

    const started = await request(app).post(
      '/api/v1/auth/google/authorization',
    );
    const callback = { code: 'valid-code', state: started.body.state };
    expect(
      (await request(app).post('/api/v1/auth/google/callback').send(callback))
        .status,
    ).toBe(200);
    const replay = await request(app)
      .post('/api/v1/auth/google/callback')
      .send(callback);
    expect(replay.status).toBe(401);
    expect(replay.body.accessToken).toBeUndefined();

    const rejected = await signIn(app, 'tampered-code');
    expect(rejected.status).toBe(401);
    expect(rejected.headers['cache-control']).toBe('no-store');
  });

  test('IT04 deactivation ends access and blocks a new sign-in', async () => {
    const { app, repository } = build();
    const response = await signIn(app);
    const token = response.body.accessToken;
    const user = await repository.findById(
      UserId.create(response.body.user.id),
    );
    user.deactivate();
    await repository.save(user);
    // AA03 (BR 8): the existing token now gets the access-denied message.
    const denied = await request(app).get('/api/v1/stock').set(auth(token));
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({
      error: { message: 'Account is not active', status: 403 },
    });
    const again = await signIn(app);
    expect(again.status).toBe(403);
    expect(again.body).toEqual({
      error: { message: 'Account is not active', status: 403 },
    });
  });

  test('IT04 an e-mail already used by a local account is a conflict', async () => {
    const { app } = build();
    await request(app).post('/api/v1/users/register').send({
      name: 'Local Ana',
      email: 'ana.silva@gmail.com',
      password: 'LocalSecure123!',
      phoneNumber: '+351912345678',
    });
    const response = await signIn(app);
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/already associated/);
  });

  test('IT05 public rate limit applies to the Google routes', async () => {
    const { app } = build({ rateLimit: { limit: 2 } });
    await request(app).post('/api/v1/auth/google/authorization');
    await request(app).post('/api/v1/auth/google/authorization');
    const limited = await request(app).post(
      '/api/v1/auth/google/authorization',
    );
    expect(limited.status).toBe(429);
  });

  test('IT05 without Google configuration the routes do not exist and local login works', async () => {
    const repository = new MemoryUserRepository();
    const userModule = createUserModule({
      repository,
      security,
      externalIdentity: null,
    });
    const app = createApp({ userModule });
    expect(
      (await request(app).post('/api/v1/auth/google/authorization')).status,
    ).toBe(404);
    await repository.save(
      createUser({
        name: 'Ana',
        email: 'ana@example.com',
        passwordHash: await userModule.hasher.hash('LocalSecure123!'),
        roles: ['CUSTOMER'],
      }),
    );
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'LocalSecure123!' });
    expect(login.status).toBe(200);
    expect(login.body.hasLocalCredential).toBe(true);
  });

  test('IT05 an external-only account cannot use local login', async () => {
    const { app } = build();
    await signIn(app);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ana.silva@gmail.com', password: 'any-password' });
    expect(login.status).toBe(401);
    expect(login.body.error.message).toBe('Invalid email or password');
  });
});
describe('AA03 role resolution after Google sign-in', () => {
  const me = (app, token) =>
    request(app).get('/api/v1/auth/me').set(auth(token));

  test('IT08: Google and local sign-in resolve roles the same way through /auth/me', async () => {
    const { app, repository } = build();
    const google = await signIn(app);
    expect(google.status).toBe(200);
    const fromGoogle = await me(app, google.body.accessToken);
    expect(fromGoogle.status).toBe(200);
    expect(fromGoogle.body).toMatchObject({
      roles: ['CUSTOMER'],
      active: true,
    });

    const registration = await request(app)
      .post('/api/v1/users/register')
      .send({
        name: 'Local Rui',
        email: 'rui@example.com',
        phoneNumber: '+351912345678',
        password: 'LocalSecure123!',
      });
    expect(registration.status).toBe(201);
    const localUser = await repository.findById(
      UserId.create(registration.body.id),
    );
    localUser.activateByInvitation();
    await repository.save(localUser);
    const local = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rui@example.com', password: 'LocalSecure123!' });
    expect(local.status).toBe(200);
    const fromLocal = await me(app, local.body.accessToken);
    expect(fromLocal.body.roles).toEqual(fromGoogle.body.roles);

    // Same token, role changed in the database: /auth/me and routes follow it.
    const user = await repository.findById(UserId.create(google.body.user.id));
    user.setRoles(['CUSTOMER', 'MANAGER']);
    await repository.save(user);
    expect((await me(app, google.body.accessToken)).body.roles).toEqual([
      'CUSTOMER',
      'MANAGER',
    ]);
  });

  test('IT08: a Google account left without roles is denied with the same message', async () => {
    const { app, repository } = build();
    const first = await signIn(app);
    const user = await repository.findById(UserId.create(first.body.user.id));
    user.setRoles([]);
    await repository.save(user);
    const expected = {
      error: {
        message: 'No active role is assigned to this account',
        status: 403,
      },
    };
    expect((await me(app, first.body.accessToken)).body).toEqual(expected);
    const again = await signIn(app);
    expect(again.status).toBe(403);
    expect(again.body).toEqual(expected);
    // The revoked CUSTOMER role is not restored by signing in again (BR 5).
    expect(
      (await repository.findById(UserId.create(first.body.user.id))).getRoles(),
    ).toEqual([]);
  });
});
