import { jest } from '@jest/globals';
import {
  ExternalAuthenticationService,
  EXTERNAL_AUTH_FAILED,
  ACCOUNT_NOT_ACTIVE,
  NO_ACTIVE_ROLE,
  EMAIL_ALREADY_ASSOCIATED,
} from '../../../src/modules/user-authentication-management/application/services/ExternalAuthenticationService.js';
import { UserService } from '../../../src/modules/user-authentication-management/application/services/UserService.js';
import { ExternalAuthorizationDTO } from '../../../src/modules/user-authentication-management/application/dtos/ExternalAuthorizationDTO.js';
import { ExternalCallbackDTO } from '../../../src/modules/user-authentication-management/application/dtos/ExternalCallbackDTO.js';
import { ExternalIdentityClaims } from '../../../src/modules/user-authentication-management/application/dtos/ExternalIdentityClaims.js';
import { InMemoryAuthorizationStateStore } from '../../../src/modules/user-authentication-management/infrastructure/security/InMemoryAuthorizationStateStore.js';
import { User } from '../../../src/modules/user-authentication-management/domain/model/User.js';
import { ExternalIdentity } from '../../../src/modules/user-authentication-management/domain/model/values.js';
import { AppError } from '../../../src/shared/errors/AppError.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { createUser } from '../../helpers/createUser.js';

const hash = '$2b$10$' + 'a'.repeat(53);
const SUBJECT = '109876543210987654321';
const claims = (overrides = {}) =>
  new ExternalIdentityClaims({
    provider: 'GOOGLE',
    subject: SUBJECT,
    email: 'ana.silva@gmail.com',
    emailVerified: true,
    name: 'Ana Silva',
    ...overrides,
  });

function setup({ verify = async () => claims() } = {}) {
  const repository = new MemoryUserRepository();
  const provider = {
    provider: 'GOOGLE',
    createAuthorizationRequest: jest.fn().mockResolvedValue({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
      state: 'state-value-0123456789',
      nonce: 'nonce-value',
      codeVerifier: 'verifier-value',
    }),
    exchangeAndVerify: jest.fn().mockImplementation(verify),
  };
  const store = new InMemoryAuthorizationStateStore();
  const tokens = {
    generateToken: jest.fn().mockReturnValue('signed-token'),
    verifyToken: jest.fn(),
    expiresIn: '1d',
  };
  const userService = new UserService(repository, {}, tokens);
  const logger = { warn: jest.fn() };
  const service = new ExternalAuthenticationService(
    repository,
    provider,
    store,
    userService,
    logger,
  );
  const callback = async (state = 'state-value-0123456789') =>
    service.completeAuthorization(
      new ExternalCallbackDTO({ code: 'auth-code-secret', state }),
    );
  return { repository, provider, store, tokens, service, logger, callback };
}
async function expectStatus(promise, status, message) {
  const error = await promise.catch((e) => e);
  expect(error).toBeInstanceOf(AppError);
  expect(error.status).toBe(status);
  if (message) expect(error.message).toBe(message);
}
async function linkedUser(
  repository,
  { roles = ['CUSTOMER'], active = true } = {},
) {
  const user = createUser({
    name: 'Linked',
    email: 'linked@example.com',
    passwordHash: hash,
    roles,
  });
  user.linkExternalIdentity(ExternalIdentity.create('GOOGLE', SUBJECT));
  if (!active) user.deactivate();
  return repository.save(user);
}

describe('AA02 ExternalAuthenticationService', () => {
  test('UT05 startAuthorization stores one-time state and returns only URL and state', async () => {
    const { service, provider, store } = setup();
    const result = await service.startAuthorization();
    expect(result).toBeInstanceOf(ExternalAuthorizationDTO);
    expect(result).toEqual({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
      state: 'state-value-0123456789',
    });
    expect(JSON.stringify(result)).not.toMatch(/nonce|verifier/);
    expect(provider.createAuthorizationRequest).toHaveBeenCalledTimes(1);
    const pending = store.consume('state-value-0123456789');
    expect(pending).toMatchObject({
      provider: 'GOOGLE',
      nonce: 'nonce-value',
      codeVerifier: 'verifier-value',
    });
    expect(pending.expiresAt).toBeGreaterThan(Date.now());
  });

  test('UT06 linked active user gets a token with internal roles only', async () => {
    const ctx = setup({
      verify: async () => ({ ...claims(), roles: ['MANAGER'] }),
    });
    await linkedUser(ctx.repository, { roles: ['EMPLOYEE'] });
    await ctx.service.startAuthorization();
    const result = await ctx.callback();
    expect(ctx.provider.exchangeAndVerify).toHaveBeenCalledWith(
      'auth-code-secret',
      'verifier-value',
      'nonce-value',
    );
    expect(ctx.tokens.generateToken).toHaveBeenCalledWith({
      sub: expect.stringMatching(/^USR-\d{5,}$/),
      email: 'linked@example.com',
      roles: ['EMPLOYEE'],
    });
    expect(result).toMatchObject({
      accessToken: 'signed-token',
      tokenType: 'Bearer',
      expiresIn: '1d',
      user: { email: 'linked@example.com', roles: ['EMPLOYEE'] },
    });
    expect(ctx.repository.users.size).toBe(1);
  });

  test('UT07 unknown identity with a free e-mail creates one active CUSTOMER account', async () => {
    const ctx = setup();
    await ctx.service.startAuthorization();
    const result = await ctx.callback();
    expect(result.user).toMatchObject({
      name: 'Ana Silva',
      email: 'ana.silva@gmail.com',
      roles: ['CUSTOMER'],
      active: true,
      marketingConsent: false,
    });
    expect(ctx.repository.users.size).toBe(1);
    const saved = await ctx.repository.findByExternalIdentity(
      'GOOGLE',
      SUBJECT,
    );
    expect(saved.hasLocalPassword()).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/password|hash|nonce|verifier/i);
  });

  test('UT07 display name falls back to the e-mail local part', async () => {
    const ctx = setup({ verify: async () => claims({ name: '   ' }) });
    await ctx.service.startAuthorization();
    expect((await ctx.callback()).user.name).toBe('ana.silva');
    const long = setup({
      verify: async () => claims({ name: 'N'.repeat(150) }),
    });
    await long.service.startAuthorization();
    expect((await long.callback()).user.name).toHaveLength(100);
  });

  test('UT08 inactive or role-less accounts are denied and never modified', async () => {
    const inactive = setup();
    await linkedUser(inactive.repository, { active: false });
    await inactive.service.startAuthorization();
    await expectStatus(inactive.callback(), 403, ACCOUNT_NOT_ACTIVE);
    const stored = [...inactive.repository.users.values()][0];
    expect(stored.active).toBe(false);
    expect(inactive.tokens.generateToken).not.toHaveBeenCalled();

    const roleless = setup();
    const user = await linkedUser(roleless.repository);
    jest.spyOn(User.prototype, 'hasActiveRole').mockReturnValue(false);
    roleless.repository.findByExternalIdentity = async () => user;
    try {
      await roleless.service.startAuthorization();
      await expectStatus(roleless.callback(), 403, NO_ACTIVE_ROLE);
    } finally {
      User.prototype.hasActiveRole.mockRestore();
    }
    expect(roleless.tokens.generateToken).not.toHaveBeenCalled();
  });

  test('UT09 e-mail used by another account is a conflict without linking', async () => {
    const ctx = setup({
      verify: async () => claims({ email: 'taken@example.com' }),
    });
    await ctx.repository.save(
      createUser({
        name: 'Local',
        email: 'taken@example.com',
        passwordHash: hash,
        roles: ['MANAGER'],
      }),
    );
    await ctx.service.startAuthorization();
    await expectStatus(ctx.callback(), 409, EMAIL_ALREADY_ASSOCIATED);
    expect(ctx.repository.users.size).toBe(1);
    expect(
      await ctx.repository.findByExternalIdentity('GOOGLE', SUBJECT),
    ).toBeNull();
    expect(ctx.tokens.generateToken).not.toHaveBeenCalled();
  });

  test('UT09 concurrent first sign-in conflict is reported as 409', async () => {
    const ctx = setup();
    ctx.repository.save = async () => {
      throw new AppError('External identity already linked', 409);
    };
    await ctx.service.startAuthorization();
    await expectStatus(ctx.callback(), 409, EMAIL_ALREADY_ASSOCIATED);
  });

  test('UT10 unknown, expired and reused state fail without calling the provider', async () => {
    let now = 0;
    const ctx = setup();
    await expectStatus(
      ctx.callback('never-issued-state-1'),
      401,
      EXTERNAL_AUTH_FAILED,
    );

    ctx.service.stateStore = new InMemoryAuthorizationStateStore({
      now: () => now,
    });
    await ctx.service.startAuthorization();
    now += 10 * 60 * 1000;
    await expectStatus(ctx.callback(), 401, EXTERNAL_AUTH_FAILED);
    expect(ctx.provider.exchangeAndVerify).not.toHaveBeenCalled();

    now = 0;
    await ctx.service.startAuthorization();
    await ctx.callback();
    await expectStatus(ctx.callback(), 401, EXTERNAL_AUTH_FAILED);
    expect(ctx.provider.exchangeAndVerify).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      'provider error',
      async () => {
        throw new Error('invalid ID token');
      },
    ],
    ['unverified e-mail', async () => claims({ emailVerified: false })],
    ['missing e-mail', async () => claims({ email: undefined })],
    ['missing subject', async () => claims({ subject: '' })],
    ['other provider', async () => claims({ provider: 'OTHER' })],
    ['malformed e-mail', async () => claims({ email: 'not-an-email' })],
  ])(
    'UT11 %s gives the uniform 401 and logs no secrets',
    async (_name, verify) => {
      const ctx = setup({ verify });
      await ctx.service.startAuthorization();
      await expectStatus(ctx.callback(), 401, EXTERNAL_AUTH_FAILED);
      expect(ctx.repository.users.size).toBe(0);
      expect(ctx.logger.warn).toHaveBeenCalled();
      const logged = JSON.stringify(ctx.logger.warn.mock.calls);
      expect(logged).not.toMatch(/auth-code-secret|verifier-value|nonce-value/);
    },
  );

  test('verifyIdentity is reusable on its own (AA07) and consumes the state', async () => {
    const ctx = setup();
    await ctx.service.startAuthorization();
    const verified = await ctx.service.verifyIdentity(
      'auth-code-secret',
      'state-value-0123456789',
    );
    expect(verified).toMatchObject({ subject: SUBJECT, emailVerified: true });
    expect(ctx.repository.users.size).toBe(0);
    await expectStatus(
      ctx.service.verifyIdentity('auth-code-secret', 'state-value-0123456789'),
      401,
    );
  });
});
describe('AA03 shared access-state check', () => {
  test('UT12: Google sign-in uses UserService.assertCanAccess and gets [CUSTOMER] from the aggregate', async () => {
    const ctx = setup();
    const spy = jest.spyOn(ctx.service.userService, 'assertCanAccess');
    await ctx.service.startAuthorization();
    const result = await ctx.callback();
    expect(result.user.roles).toEqual(['CUSTOMER']);
    expect(spy).toHaveBeenCalledTimes(1);

    const roleless = setup();
    await linkedUser(roleless.repository, { roles: [] });
    await roleless.service.startAuthorization();
    await expectStatus(roleless.callback(), 403, NO_ACTIVE_ROLE);
    expect(roleless.tokens.generateToken).not.toHaveBeenCalled();
  });
});
