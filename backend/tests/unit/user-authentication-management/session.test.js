import { SessionCredentialService } from '../../../src/modules/user-authentication-management/infrastructure/security/SessionCredentialService.js';
import { loadSessionConfig } from '../../../src/modules/user-authentication-management/infrastructure/security/sessionConfig.js';
import { UserService } from '../../../src/modules/user-authentication-management/application/services/UserService.js';
import { InMemoryApplicationSessionRepository } from '../../../src/modules/user-authentication-management/infrastructure/security/InMemoryApplicationSessionRepository.js';
import { createUser } from '../../helpers/createUser.js';
import { ExternalAuthenticationService } from '../../../src/modules/user-authentication-management/application/services/ExternalAuthenticationService.js';

const config = {
  idleTimeoutSeconds: 600,
  activityReportIntervalSeconds: 30,
  sessionRetentionSeconds: 604800,
  accessTokenTtl: '5m',
  cookieSecure: false,
};
const credentials = new SessionCredentialService();
function setup() {
  const user = createUser({
    name: 'Ana',
    email: 'ana@example.com',
    passwordHash: '$2b$10$' + 'a'.repeat(53),
    roles: ['CUSTOMER'],
  });
  const users = { findByEmail: async () => user, findById: async () => user };
  const tokens = {
    expiresIn: '5m',
    generateToken: (payload) => JSON.stringify(payload),
    verifyToken: (token) => JSON.parse(token),
  };
  const sessions = new InMemoryApplicationSessionRepository();
  const service = new UserService(
    users,
    { compare: async () => true },
    tokens,
    null,
    sessions,
    credentials,
    config,
  );
  return { service, sessions, user };
}

describe('AA04 session lifecycle', () => {
  test('issues a session-bound token and rejects a revoked or expired session', async () => {
    const { service, sessions, user } = setup();
    const auth = await service.establishSession(user);
    const claims = JSON.parse(auth.accessToken);
    expect(claims).toMatchObject({
      sub: user.getId().getValue(),
      sid: expect.any(String),
    });
    expect(await service.resolveActor(auth.accessToken)).toMatchObject({
      sub: user.getId().getValue(),
    });
    const parsed = credentials.parse(auth.sessionCredential);
    const record = await sessions.findByCredential(parsed.id, parsed.hash);
    record.idle_expires_at = new Date(Date.now() - 1000);
    await expect(service.resolveActor(auth.accessToken)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      service.renew(auth.sessionCredential, auth.csrfToken),
    ).rejects.toMatchObject({ status: 401 });
  });

  test('logout revokes the current session and blocks renewed credentials', async () => {
    const { service, user } = setup();
    const auth = await service.establishSession(user);
    await service.logout(auth.sessionCredential, auth.csrfToken);
    await expect(service.resolveActor(auth.accessToken)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      service.renew(auth.sessionCredential, auth.csrfToken),
    ).rejects.toMatchObject({ status: 401 });
  });

  test('logout affects only the current device session', async () => {
    const { service, user } = setup();
    const first = await service.establishSession(user);
    const second = await service.establishSession(user);
    await service.logout(first.sessionCredential, first.csrfToken);
    await expect(service.resolveActor(first.accessToken)).rejects.toMatchObject(
      { status: 401 },
    );
    await expect(
      service.resolveActor(second.accessToken),
    ).resolves.toMatchObject({ sub: user.getId().getValue() });
  });

  test('renewal rotates the cookie credential, CSRF token and access-token session id', async () => {
    const { service, user } = setup();
    const first = await service.establishSession(user);
    const renewed = await service.renew(
      first.sessionCredential,
      first.csrfToken,
    );

    expect(renewed.sessionCredential).not.toBe(first.sessionCredential);
    expect(renewed.csrfToken).not.toBe(first.csrfToken);
    expect(JSON.parse(renewed.accessToken).sid).not.toBe(
      JSON.parse(first.accessToken).sid,
    );
    await expect(service.resolveActor(first.accessToken)).rejects.toMatchObject(
      { status: 401 },
    );
    await expect(
      service.renew(first.sessionCredential, first.csrfToken),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.resolveActor(renewed.accessToken),
    ).resolves.toMatchObject({ sub: user.getId().getValue() });
  });

  test('an active session remains renewable after the former eight-hour cap', async () => {
    const { service, sessions, user } = setup();
    const auth = await service.establishSession(user);
    const parsed = credentials.parse(auth.sessionCredential);
    const record = await sessions.findByCredential(parsed.id, parsed.hash);
    record.created_at = new Date(Date.now() - 9 * 60 * 60 * 1000);

    const renewed = await service.renew(auth.sessionCredential, auth.csrfToken);
    await expect(
      service.resolveActor(renewed.accessToken),
    ).resolves.toMatchObject({ sub: user.getId().getValue() });
  });

  test('resume restores an active session without extending its inactivity deadline', async () => {
    const { service, user, sessions } = setup();
    const auth = await service.establishSession(user);
    const parsed = credentials.parse(auth.sessionCredential);
    const record = await sessions.findByCredential(parsed.id, parsed.hash);
    const originalDeadline = record.idle_expires_at;
    const resumed = await service.resume(auth.sessionCredential);
    expect(JSON.parse(resumed.accessToken).sid).toBe(
      JSON.parse(auth.accessToken).sid,
    );
    expect(resumed.csrfToken).toBe(auth.csrfToken);
    expect(resumed.idleExpiresAt).toBe(originalDeadline);
    expect(await service.resolveActor(resumed.accessToken)).toMatchObject({
      sub: user.getId().getValue(),
    });
  });

  test('renewal rechecks account status and denies an inactive user', async () => {
    const { service, user } = setup();
    const auth = await service.establishSession(user);
    user.deactivate();
    await expect(
      service.renew(auth.sessionCredential, auth.csrfToken),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.resolveActor(auth.accessToken)).rejects.toMatchObject({
      status: 403,
    });
  });

  test('verified external authentication establishes the same server session', async () => {
    const { service, user } = setup();
    const external = new ExternalAuthenticationService(
      { findByExternalIdentity: async () => user },
      {
        provider: 'GOOGLE',
        exchangeAndVerify: async () => ({
          provider: 'GOOGLE',
          emailVerified: true,
          email: 'ana@example.com',
          subject: 'google-subject',
        }),
      },
      {
        consume: () => ({
          provider: 'GOOGLE',
          nonce: 'nonce',
          codeVerifier: 'verifier',
        }),
      },
      service,
      { warn: () => {} },
    );
    const result = await external.completeAuthorization({
      code: 'code',
      state: 'state',
    });
    expect(result.sessionCredential).toBeTruthy();
    expect(JSON.parse(result.accessToken)).toMatchObject({
      sub: user.getId().getValue(),
      sid: expect.any(String),
    });
    expect(await service.resolveActor(result.accessToken)).toMatchObject({
      sub: user.getId().getValue(),
    });
  });

  test('rejects a wrong CSRF token and validates explicit inactivity configuration', async () => {
    const { service, user } = setup();
    const auth = await service.establishSession(user);
    await expect(
      service.renew(auth.sessionCredential, 'wrong'),
    ).rejects.toMatchObject({ status: 401 });
    expect(() =>
      loadSessionConfig({
        AUTH_IDLE_TIMEOUT_SECONDS: '0',
        ACTIVITY_REPORT_INTERVAL_SECONDS: '10',
      }),
    ).toThrow();
    expect(
      loadSessionConfig({
        AUTH_IDLE_TIMEOUT_SECONDS: '600',
        ACTIVITY_REPORT_INTERVAL_SECONDS: '30',
        ACCESS_TOKEN_TTL: '5m',
      }),
    ).toMatchObject({
      idleTimeoutSeconds: 600,
      sessionRetentionSeconds: 604800,
    });
  });

  test('rejects an activity renewal interval that can outlive the access JWT', () => {
    expect(() =>
      loadSessionConfig({
        AUTH_IDLE_TIMEOUT_SECONDS: '600',
        ACTIVITY_REPORT_INTERVAL_SECONDS: '60',
        ACCESS_TOKEN_TTL: '30s',
      }),
    ).toThrow(/ACTIVITY_REPORT_INTERVAL_SECONDS.*ACCESS_TOKEN_TTL/);
    expect(() =>
      loadSessionConfig({
        AUTH_IDLE_TIMEOUT_SECONDS: '600',
        ACTIVITY_REPORT_INTERVAL_SECONDS: '10',
        ACCESS_TOKEN_TTL: '30s',
      }),
    ).not.toThrow();
  });
});
