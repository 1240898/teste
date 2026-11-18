import {
  beginGoogleSignIn,
  beginGoogleActivation,
  handleGoogleRedirect,
  MESSAGES,
  OIDC_STATE_KEY,
} from '../../../src/features/authentication/services/session/googleSignIn.js';
import { AuthApiError } from '../../../src/features/authentication/services/session/authApi.js';
import { ACTIVATION_STATE_KEY } from '../../../src/features/authentication/services/activationApi.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}
const query = (params) => new URLSearchParams(params);

it('routes an invited Google recipient through activation without saving the invitation token', async () => {
  const storage = memoryStorage({ [OIDC_STATE_KEY]: 'old-sign-in-state' });
  const login = { completeGoogleLogin: jest.fn() };
  const activation = {
    startExternal: jest
      .fn()
      .mockResolvedValue({
        state: 'activation-state',
        authorizationUrl: 'https://accounts.google.com/auth',
      }),
    completeExternal: jest
      .fn()
      .mockResolvedValue({ status: 'ACTIVATED', nextSignIn: 'EXTERNAL' }),
  };
  const navigate = jest.fn();
  await beginGoogleActivation('invitation-token', {
    api: activation,
    storage,
    navigate,
  });
  expect([...storage.values.entries()]).toEqual([
    [ACTIVATION_STATE_KEY, 'activation-state'],
  ]);
  const result = await handleGoogleRedirect(
    query({ code: 'proof', state: 'activation-state' }),
    { activation, api: login, storage },
  );
  expect(result).toEqual({ status: 'activated' });
  expect(activation.completeExternal).toHaveBeenCalledWith(
    'proof',
    'activation-state',
  );
  expect(login.completeGoogleLogin).not.toHaveBeenCalled();
  expect(storage.getItem(ACTIVATION_STATE_KEY)).toBeNull();
});

describe('AA02 Google sign-in in the SPA', () => {
  it('stores the state and redirects to Google', async () => {
    const storage = memoryStorage();
    const navigate = jest.fn();
    await beginGoogleSignIn({
      api: {
        startGoogleLogin: async () => ({
          authorizationUrl: 'https://accounts.google.com/auth',
          state: 'expected-state',
        }),
      },
      storage,
      navigate,
    });
    expect(storage.getItem(OIDC_STATE_KEY)).toBe('expected-state');
    expect(navigate).toHaveBeenCalledWith('https://accounts.google.com/auth');
  });

  it('completes sign-in when the returned state matches', async () => {
    const storage = memoryStorage({ [OIDC_STATE_KEY]: 'expected-state' });
    const session = { accessToken: 't', user: { roles: ['CUSTOMER'] } };
    const api = { completeGoogleLogin: jest.fn().mockResolvedValue(session) };
    const result = await handleGoogleRedirect(
      query({ code: 'the-code', state: 'expected-state' }),
      { api, storage },
    );
    expect(result).toEqual({ status: 'signed-in', session });
    expect(api.completeGoogleLogin).toHaveBeenCalledWith(
      'the-code',
      'expected-state',
    );
    expect(storage.getItem(OIDC_STATE_KEY)).toBeNull();
  });

  it.each([
    [
      'cancelled at Google',
      { error: 'access_denied', state: 'expected-state' },
      MESSAGES.cancelled,
    ],
    [
      'state mismatch',
      { code: 'c', state: 'other-state' },
      MESSAGES.incomplete,
    ],
    ['missing code', { state: 'expected-state' }, MESSAGES.incomplete],
  ])('does not call the back end when %s', async (_name, params, message) => {
    const storage = memoryStorage({ [OIDC_STATE_KEY]: 'expected-state' });
    const api = { completeGoogleLogin: jest.fn() };
    const result = await handleGoogleRedirect(query(params), { api, storage });
    expect(result).toEqual({ status: 'error', message });
    expect(api.completeGoogleLogin).not.toHaveBeenCalled();
    expect(storage.getItem(OIDC_STATE_KEY)).toBeNull();
  });

  it('rejects a callback when no sign-in was started in this browser', async () => {
    const api = { completeGoogleLogin: jest.fn() };
    const result = await handleGoogleRedirect(
      query({ code: 'c', state: 's' }),
      {
        api,
        storage: memoryStorage(),
      },
    );
    expect(result.message).toBe(MESSAGES.incomplete);
    expect(api.completeGoogleLogin).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'External authentication failed', MESSAGES.failed],
    [500, 'Internal Server Error', MESSAGES.failed],
    [400, 'Invalid request body', MESSAGES.incomplete],
    [403, 'Account is not active', 'Account is not active'],
    [
      409,
      'This e-mail is already associated with an account.',
      'This e-mail is already associated with an account.',
    ],
  ])('maps a %s response to user feedback', async (status, message, shown) => {
    const storage = memoryStorage({ [OIDC_STATE_KEY]: 's' });
    const api = {
      completeGoogleLogin: jest
        .fn()
        .mockRejectedValue(new AuthApiError(status, message)),
    };
    const result = await handleGoogleRedirect(
      query({ code: 'c', state: 's' }),
      {
        api,
        storage,
      },
    );
    expect(result).toEqual({ status: 'error', message: shown });
  });
});
