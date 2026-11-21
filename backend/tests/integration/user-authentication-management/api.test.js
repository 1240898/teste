import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { createUser } from '../../helpers/createUser.js';
import { UserId } from '../../../src/modules/user-authentication-management/domain/model/values.js';
const security = {
  secret: 'test-only-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const email = 'ana@example.com';
const password = 'StrongPass123!';
let app,
  repository,
  userModule,
  managerToken,
  customerToken,
  customerId,
  administratorId;
beforeEach(async () => {
  repository = new MemoryUserRepository();
  userModule = createUserModule({ repository, security });
  app = createApp({ userModule });
  const manager = createUser({
    name: 'Administrator',
    email: 'admin@example.com',
    passwordHash: await userModule.hasher.hash(password),
    roles: ['ADMINISTRATOR', 'MANAGER'],
  });
  await repository.save(manager);
  administratorId = manager.getId().getValue();
  managerToken = userModule.tokens.generateToken({
    sub: manager.getId().getValue(),
    email: manager.getEmail().getValue(),
    roles: manager.getRoles(),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});
async function register() {
  const result = await request(app).post('/api/v1/users/register').send({
    name: 'Ana',
    email,
    password,
    marketingConsent: true,
    phoneNumber: '+351912345678',
  });
  customerId = result.body.id;
  return result;
}
async function login() {
  const result = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: ' ANA@example.com ', password });
  customerToken = result.body.accessToken;
  return result;
}
async function activateCustomer() {
  const customer = await repository.findById(UserId.create(customerId));
  customer.activateByInvitation();
  await repository.save(customer);
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });
describe('BCK01 HTTP contract (real security, in-memory persistence)', () => {
  test('registers, logs in and protects user queries', async () => {
    const registered = await register();
    expect(registered.status).toBe(201);
    expect(registered.headers.location).toBe(`/api/v1/users/${customerId}`);
    expect(registered.body).toMatchObject({
      roles: ['CUSTOMER'],
      active: false,
      marketingConsent: true,
    });
    expect(registered.body.invitationDelivery).toMatchObject({
      deliveryStatus: 'NOT_CONFIGURED',
      retryable: true,
    });
    expect(
      (await request(app).get('/api/v1/users').set(auth(managerToken))).body,
    ).toHaveLength(1);
    expect(
      (
        await request(app)
          .get('/api/v1/users?includeInactive=true')
          .set(auth(managerToken))
      ).body,
    ).toHaveLength(2);
    expect(JSON.stringify(registered.body)).not.toMatch(/password|hash/i);
    const inactiveLogin = await login();
    expect(inactiveLogin.status).toBe(403);
    expect(inactiveLogin.body).toEqual({
      error: { message: 'Account is not active', status: 403 },
    });
    await activateCustomer();
    const loggedIn = await login();
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: '1d',
    });
    expect(
      (await request(app).get('/api/v1/users').set(auth(customerToken))).status,
    ).toBe(403);
    const listed = await request(app)
      .get('/api/v1/users')
      .set(auth(managerToken));
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(2);
    expect(JSON.stringify(listed.body)).not.toMatch(/password|hash/i);
    expect(
      (
        await request(app)
          .get(`/api/v1/users/${customerId}`)
          .set(auth(managerToken))
      ).body.id,
    ).toBe(customerId);
  });
  test('changes password only for the authenticated account and accepts only the new credential afterwards', async () => {
    await register();
    await activateCustomer();
    await login();
    const changed = await request(app)
      .patch('/api/v1/auth/password')
      .set(auth(customerToken))
      .send({
        currentPassword: password,
        newPassword: 'DifferentSecure456!',
      });
    expect(changed.status).toBe(204);
    expect(changed.text).toBe('');

    expect(
      (await request(app).post('/api/v1/auth/login').send({ email, password }))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email, password: 'DifferentSecure456!' })
      ).status,
    ).toBe(200);
  });
  test('requires authentication and the correct current password for password change', async () => {
    await register();
    await activateCustomer();
    const unauthenticated = await request(app)
      .patch('/api/v1/auth/password')
      .send({
        currentPassword: password,
        newPassword: 'DifferentSecure456!',
      });
    expect(unauthenticated.status).toBe(401);

    await login();
    const incorrect = await request(app)
      .patch('/api/v1/auth/password')
      .set(auth(customerToken))
      .send({
        currentPassword: 'IncorrectSecure123!',
        newPassword: 'DifferentSecure456!',
      });
    expect(incorrect.status).toBe(401);
    expect(
      (await request(app).post('/api/v1/auth/login').send({ email, password }))
        .status,
    ).toBe(200);
  });
  test('rejects mass assignment and invalid request shapes', async () => {
    for (const change of [
      { roles: ['MANAGER'] },
      { active: false },
      { passwordHash: 'hash' },
      { name: '' },
      { email: 'bad' },
      { password: 'short' },
      { password: 'é'.repeat(37) },
      { marketingConsent: 'true' },
      // GDP01: the phone number is required (format: selfService.api.test.js).
      { phoneNumber: undefined },
    ]) {
      const result = await request(app)
        .post('/api/v1/users/register')
        .send({
          name: 'Ana',
          email,
          password,
          phoneNumber: '+351912345678',
          ...change,
        });
      expect(result.status).toBe(400);
      expect(JSON.stringify(result.body)).not.toContain(password);
    }
    expect(
      (await request(app).post('/api/v1/users/register').send([])).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('Content-Type', 'application/json')
          .send('{')
      ).status,
    ).toBe(400);
  });
  test('normalizes duplicate email and returns uniform credential failures', async () => {
    await register();
    expect(
      (
        await request(app).post('/api/v1/users/register').send({
          name: 'Other',
          email: email.toUpperCase(),
          password,
          phoneNumber: '+351912345678',
        })
      ).status,
    ).toBe(409);
    const failures = [];
    for (const body of [
      { email: 'unknown@example.com', password },
      { email, password: 'wrong' },
    ])
      failures.push(await request(app).post('/api/v1/auth/login').send(body));
    await request(app)
      .delete(`/api/v1/users/${customerId}`)
      .set(auth(managerToken));
    // AA03: a deactivated account with a WRONG password stays generic.
    failures.push(
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong' }),
    );
    for (const result of failures)
      expect(result.body).toEqual({
        error: { message: 'Invalid email or password', status: 401 },
      });
    // AA03 (BR 12): with the correct password the access-denied reason is given.
    const denied = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({
      error: { message: 'Account is not active', status: 403 },
    });
    expect(denied.body.accessToken).toBeUndefined();
  });
  test('uses current roles and rejects an existing token after deactivation', async () => {
    await register();
    await activateCustomer();
    await login();
    const changed = await request(app)
      .patch(`/api/v1/users/${customerId}/roles`)
      .set(auth(managerToken))
      .send({ roles: ['CUSTOMER', 'ADMINISTRATOR'] });
    expect(changed.status).toBe(200);
    expect(
      (await request(app).get('/api/v1/users').set(auth(customerToken))).status,
    ).toBe(200);
    await request(app)
      .patch(`/api/v1/users/${customerId}/roles`)
      .set(auth(managerToken))
      .send({ roles: ['CUSTOMER'] });
    expect(
      (await request(app).get('/api/v1/users').set(auth(customerToken))).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/v1/users/${customerId}`)
          .set(auth(managerToken))
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .delete(`/api/v1/users/${customerId}`)
          .set(auth(managerToken))
      ).status,
    ).toBe(204);
    // AA03 (BR 8): deactivated after login -> access-denied message.
    const afterDeactivation = await request(app)
      .get('/api/v1/users')
      .set(auth(customerToken));
    expect(afterDeactivation.status).toBe(403);
    expect(afterDeactivation.body).toEqual({
      error: { message: 'Account is not active', status: 403 },
    });
    expect(repository.users.has(customerId)).toBe(true);
  });
  test('allows empty roles and prevents removing or deactivating the last Administrator', async () => {
    const emptyRoles = await request(app)
      .patch(`/api/v1/users/${administratorId}/roles`)
      .set(auth(managerToken))
      .send({ roles: [] });
    expect(emptyRoles.status).toBe(409);
    const deactivateLast = await request(app)
      .delete(`/api/v1/users/${administratorId}`)
      .set(auth(managerToken));
    expect(deactivateLast.status).toBe(409);
    await register();
    await activateCustomer();
    const removeCustomerRole = await request(app)
      .patch(`/api/v1/users/${customerId}/roles`)
      .set(auth(managerToken))
      .send({ roles: [] });
    expect(removeCustomerRole.status).toBe(200);
    expect(removeCustomerRole.body.roles).toEqual([]);
  });
  test('issues invitation replacements, reports delivery failure and rejects invitation reactivation', async () => {
    // This scenario deliberately simulates an SMTP failure. Keep the expected
    // service diagnostic out of Jest's console output; production logging is
    // unchanged.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await register();
    const repositoryAdapter = {
      replacePending: jest.fn().mockResolvedValue(undefined),
    };
    userModule.userService.invitationRepository = repositoryAdapter;
    userModule.userService.invitationTokenService = {
      create: () => ({
        plaintextToken: 'secret-token',
        tokenHash: 'a'.repeat(64),
      }),
    };
    userModule.userService.invitationDelivery = {
      sendInvitation: jest
        .fn()
        .mockRejectedValueOnce(new Error('SMTP down'))
        .mockResolvedValue(undefined),
    };
    userModule.userService.invitationValiditySeconds = 3600;
    userModule.userService.invitationWebUrl = 'https://example.test/activate';

    const failed = await request(app)
      .post(`/api/v1/users/${customerId}/activation-invitations`)
      .set(auth(managerToken));
    expect(failed.status).toBe(200);
    expect(failed.body).toMatchObject({
      deliveryStatus: 'FAILED',
      retryable: true,
    });
    expect(JSON.stringify(failed.body)).not.toContain('secret-token');
    expect(
      (
        await request(app)
          .patch(`/api/v1/users/${customerId}/activation`)
          .set(auth(managerToken))
          .send({ active: true })
      ).status,
    ).toBe(409);

    const retried = await request(app)
      .post(`/api/v1/users/${customerId}/activation-invitations`)
      .set(auth(managerToken));
    expect(retried.body.deliveryStatus).toBe('SENT');
    expect(repositoryAdapter.replacePending).toHaveBeenCalledTimes(2);
  });
  test('reactivates previously activated accounts without an invitation', async () => {
    await register();
    await activateCustomer();
    await request(app)
      .delete(`/api/v1/users/${customerId}`)
      .set(auth(managerToken))
      .expect(204);
    const restored = await request(app)
      .patch(`/api/v1/users/${customerId}/activation`)
      .set(auth(managerToken))
      .send({ active: true });
    expect(restored.status).toBe(200);
    expect(restored.body.active).toBe(true);
  });
  test('rejects missing, expired and forged tokens; accepts the diagram header alternative', async () => {
    const expired = jwt.sign({ sub: 'USR-99999' }, security.secret, {
      expiresIn: -1,
      issuer: security.issuer,
      audience: security.audience,
    });
    for (const token of ['', 'malformed', managerToken + 'x', expired])
      expect(
        (await request(app).get('/api/v1/users').set(auth(token))).status,
      ).toBe(401);
    expect((await request(app).get('/api/v1/users')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/v1/users')
          .set('x-access-token', managerToken)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get('/api/v1/users')
          .set(auth(managerToken))
          .set('x-access-token', managerToken + 'x')
      ).status,
    ).toBe(401);
  });
  test('validates protected targets and role updates after authorization', async () => {
    await register();
    await activateCustomer();
    await login();
    for (const roles of [['ADMIN'], [null], 'MANAGER'])
      expect(
        (
          await request(app)
            .patch(`/api/v1/users/${customerId}/roles`)
            .set(auth(managerToken))
            .send({ roles })
        ).status,
      ).toBe(400);
    expect(
      (await request(app).get('/api/v1/users/bad').set(auth(managerToken)))
        .status,
    ).toBe(400);
    const unknown = 'USR-99999';
    expect(
      (
        await request(app)
          .get(`/api/v1/users/${unknown}`)
          .set(auth(managerToken))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/v1/users/${unknown}/roles`)
          .set(auth(managerToken))
          .send({ roles: ['MANAGER'] })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/v1/users/${unknown}`)
          .set(auth(managerToken))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/v1/users/${customerId}`)
          .set(auth(customerToken))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/v1/users/${customerId}/roles`)
          .send({ roles: ['MANAGER'] })
      ).status,
    ).toBe(401);
  });
  test('sanitizes infrastructure errors and fails closed', async () => {
    repository.findById = async () => {
      throw new Error('secret SQL password_hash');
    };
    const result = await request(app)
      .get('/api/v1/users')
      .set(auth(managerToken));
    expect(result.status).toBe(500);
    expect(result.body.error.message).toBe('Internal Server Error');
  });
  test('throttles public authentication attempts', async () => {
    app = createApp({
      userModule: createUserModule({
        repository,
        security,
        rateLimit: { limit: 2, windowMs: 60000 },
      }),
    });
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'unknown@example.com', password })
        ).status,
      ).toBe(401);
    const limited = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(limited.status).toBe(429);
    expect(limited.body.error.status).toBe(429);
  });
});

describe('AA03 internal role resolution (HTTP)', () => {
  const me = (token) => request(app).get('/api/v1/auth/me').set(auth(token));
  const setStoredRoles = (roles) => {
    repository.users.get(customerId).roles = roles;
  };

  test('IT01: a new account always has CUSTOMER; a supplied role is rejected', async () => {
    const withRole = await request(app)
      .post('/api/v1/users/register')
      .send({
        name: 'Ana',
        email,
        password,
        phoneNumber: '+351912345678',
        roles: ['MANAGER'],
      });
    expect(withRole.status).toBe(400);
    expect((await register()).body.roles).toEqual(['CUSTOMER']);
  });

  test('IT02: GET /auth/me returns the roles stored in the database', async () => {
    await register();
    await activateCustomer();
    expect((await login()).status).toBe(200);
    const result = await me(customerToken);
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toMatchObject({
      id: customerId,
      roles: ['CUSTOMER'],
      active: true,
    });
    expect(JSON.stringify(result.body)).not.toMatch(/password|hash/i);
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
  });

  test('IT03/IT04: role changes apply to the same token; several roles are a union', async () => {
    await register();
    await activateCustomer();
    expect((await login()).status).toBe(200);
    expect(
      (await request(app).get('/api/v1/users').set(auth(customerToken))).body,
    ).toEqual({
      error: { message: 'Forbidden: insufficient permissions', status: 403 },
    });
    setStoredRoles(['CUSTOMER', 'MANAGER', 'ADMINISTRATOR']);
    expect((await me(customerToken)).body.roles).toEqual([
      'CUSTOMER',
      'MANAGER',
      'ADMINISTRATOR',
    ]);
    expect(
      (await request(app).get('/api/v1/users').set(auth(customerToken))).status,
    ).toBe(200);
  });

  test('IT05: an account left without roles or deactivated after login is denied', async () => {
    await register();
    await activateCustomer();
    expect((await login()).status).toBe(200);
    setStoredRoles([]);
    for (const result of [
      await me(customerToken),
      await request(app).get('/api/v1/users').set(auth(customerToken)),
    ])
      expect(result.body).toEqual({
        error: {
          message: 'No active role is assigned to this account',
          status: 403,
        },
      });
    const login403 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(login403.status).toBe(403);
    setStoredRoles(['CUSTOMER']);
    repository.users.get(customerId).active = false;
    expect((await me(customerToken)).body).toEqual({
      error: { message: 'Account is not active', status: 403 },
    });
  });

  test('IT06: forged role claims and role headers are not proof of authorization', async () => {
    await register();
    await activateCustomer();
    expect((await login()).status).toBe(200);
    const forged = jwt.sign(
      { sub: customerId, roles: ['MANAGER'] },
      'another-secret-that-is-long-enough-123',
      { issuer: security.issuer, audience: security.audience },
    );
    expect(
      (await request(app).get('/api/v1/users').set(auth(forged))).status,
    ).toBe(401);
    const withHeader = await request(app)
      .get('/api/v1/users')
      .set(auth(customerToken))
      .set('X-Roles', 'MANAGER');
    expect(withHeader.status).toBe(403);
  });

  test('IT07: roles that cannot be confirmed produce a sanitized 500, never 400', async () => {
    await register();
    await activateCustomer();
    expect((await login()).status).toBe(200);
    setStoredRoles(['ROOT']);
    for (const result of [
      await me(customerToken),
      await request(app).get('/api/v1/users').set(auth(customerToken)),
    ]) {
      expect(result.status).toBe(500);
      expect(result.body).toEqual({
        error: { message: 'Internal Server Error', status: 500 },
      });
    }
    setStoredRoles(['CUSTOMER']);
    repository.findById = async () => {
      throw new Error('connection lost');
    };
    const unavailable = await me(customerToken);
    expect(unavailable.status).toBe(500);
    expect(unavailable.body.error.message).toBe('Internal Server Error');
  });
});