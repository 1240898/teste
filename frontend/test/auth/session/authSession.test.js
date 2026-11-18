import { AuthApiError } from '../../../src/features/authentication/services/session/authApi.js';
import {
  UNCONFIRMED_MESSAGE,
  hasAnyRole,
  loadCurrentSession,
  startSession,
} from '../../../src/features/authentication/state/authSession.js';

const user = Object.freeze({
  id: 'USR-00007',
  name: 'Rui',
  email: 'rui@example.com',
  roles: ['CUSTOMER', 'MANAGER'],
});

const fakeApi = (me) => ({ getCurrentUser: jest.fn(me) });

describe('AA03 authSession', () => {
  test('FT01: the session uses the roles of /auth/me, not those of the sign-in answer', async () => {
    const api = fakeApi(async () => user);
    const session = await startSession(
      { accessToken: 'tok', user: { ...user, roles: ['ADMINISTRATOR'] } },
      api,
    );
    expect(session).toEqual({
      status: 'authenticated',
      token: 'tok',
      user,
      message: null,
      csrfToken: undefined,
      idleTimeoutSeconds: undefined,
      activityReportIntervalSeconds: undefined,
    });
    expect(api.getCurrentUser).toHaveBeenCalledWith('tok');
  });

  test('FT01c: without a token from a successful sign-in, /auth/me is not called', async () => {
    const api = fakeApi(async () => user);
    for (const authToken of [undefined, null, {}, { accessToken: '' }])
      expect((await startSession(authToken, api)).status).toBe('guest');
    expect(api.getCurrentUser).not.toHaveBeenCalled();
  });

  test('AA04: restores local-credential metadata with a resumed session', async () => {
    const api = fakeApi(async () => user);
    const session = await startSession(
      {
        accessToken: 'resumed-token',
        csrfToken: 'csrf',
        idleTimeoutSeconds: 600,
        activityReportIntervalSeconds: 30,
        idleExpiresAt: '2026-11-10T12:00:00.000Z',
        hasLocalCredential: true,
      },
      api,
    );

    expect(session).toMatchObject({
      status: 'authenticated',
      hasLocalCredential: true,
      csrfToken: 'csrf',
      idleTimeoutSeconds: 600,
      activityReportIntervalSeconds: 30,
      idleExpiresAt: '2026-11-10T12:00:00.000Z',
    });
  });

  test.each([
    ['403 inactive', new AuthApiError(403, 'Account is not active'), 'denied'],
    [
      '403 no role',
      new AuthApiError(403, 'No active role is assigned to this account'),
      'denied',
    ],
    ['401', new AuthApiError(401, 'Invalid or expired token'), 'guest'],
    ['500', new AuthApiError(500, 'Internal Server Error'), 'guest'],
    ['network', new AuthApiError(0, 'Network error'), 'guest'],
    ['malformed', new AuthApiError(200, 'Invalid current user data'), 'guest'],
  ])(
    'FT01: /auth/me failure (%s) keeps protected functionality unavailable',
    async (_case, error, expected) => {
      const session = await loadCurrentSession(
        'tok',
        fakeApi(async () => {
          throw error;
        }),
      );
      expect(session.status).toBe(expected);
      expect(session.token).toBeNull();
      expect(session.user).toBeNull();
      expect(hasAnyRole(session, ['CUSTOMER'])).toBe(false);
      expect(session.message).toBe(
        expected === 'denied' ? error.message : UNCONFIRMED_MESSAGE,
      );
    },
  );

  test('FT02: hasAnyRole grants the union of roles and nothing without confirmation', () => {
    const session = {
      status: 'authenticated',
      token: 't',
      user,
      message: null,
    };
    expect(hasAnyRole(session, ['MANAGER'])).toBe(true);
    expect(hasAnyRole(session, ['EMPLOYEE', 'CUSTOMER'])).toBe(true);
    expect(hasAnyRole(session, ['ADMINISTRATOR'])).toBe(false);
    expect(hasAnyRole({ ...session, status: 'loading' }, ['MANAGER'])).toBe(
      false,
    );
    expect(hasAnyRole(null, [])).toBe(false);
  });
});
