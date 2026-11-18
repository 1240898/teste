import {
  AuthApiError,
  completeGoogleLogin,
  hasCrossTabSessionLock,
  logoutSession,
  resumeSession,
  renewSession,
  startGoogleLogin,
  withSessionOperationLock,
} from '../../../src/features/authentication/services/session/authApi.js';

describe('AA02 authApi', () => {
  let originalLocksDescriptor;
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalLocksDescriptor)
      Object.defineProperty(navigator, 'locks', originalLocksDescriptor);
    else delete navigator.locks;
    originalLocksDescriptor = undefined;
  });

  it('starts Google sign-in with a POST to the back end', async () => {
    const payload = {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
      state: 'state-value-0123456789',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    await expect(startGoogleLogin()).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/auth/google/authorization',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends code and state in the body, never in the URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'token', user: { roles: [] } }),
    });

    await completeGoogleLogin('the-code', 'the-state');
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:8080/api/v1/auth/google/callback');
    expect(JSON.parse(options.body)).toEqual({
      code: 'the-code',
      state: 'the-state',
    });
    expect(options.credentials).toBe('include');
  });

  it('sends the CSRF header and includes the HttpOnly session cookie for renewal and logout', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'new' }),
    });
    await renewSession('csrf-value');
    await logoutSession('csrf-value');
    for (const [, options] of global.fetch.mock.calls) {
      expect(options.credentials).toBe('include');
      expect(options.headers['X-CSRF-Token']).toBe('csrf-value');
    }
  });

  it('serializes renewal and logout operations through the origin-wide Web Lock', async () => {
    let releaseFirst;
    let previous = Promise.resolve();
    const order = [];
    const locks = {
      request: jest.fn((name, options, operation) => {
        const turn = previous.then(async () => {
          try {
            return await operation();
          } finally {
            releaseFirst?.();
          }
        });
        previous = turn.catch(() => {});
        return turn;
      }),
    };
    const gate = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    originalLocksDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      'locks',
    );
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: locks,
    });

    const first = withSessionOperationLock(async () => {
      order.push('renew-started');
      await gate;
      order.push('renew-finished');
    });
    const second = withSessionOperationLock(async () => {
      order.push('logout-started');
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(hasCrossTabSessionLock()).toBe(true);
    expect(order).toEqual(['renew-started']);
    expect(locks.request).toHaveBeenCalledWith(
      'laprizza-auth-session-operation',
      { mode: 'exclusive' },
      expect.any(Function),
    );

    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual([
      'renew-started',
      'renew-finished',
      'logout-started',
    ]);
  });

  it('restores a session using the HttpOnly cookie and same-site origin', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'resumed' }),
    });
    await resumeSession();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/auth/resume',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('exposes the back-end status and message on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { message: 'Account is not active', status: 403 },
      }),
    });

    const error = await completeGoogleLogin('c', 's').catch((e) => e);
    expect(error).toBeInstanceOf(AuthApiError);
    expect(error.status).toBe(403);
    expect(error.message).toBe('Account is not active');
  });
});
