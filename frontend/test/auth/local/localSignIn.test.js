/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../../src/app/App.jsx';
import { AuthProvider } from '../../../src/features/authentication/state/AuthProvider.jsx';
import { LOCALE_STORAGE_KEY } from '../../../src/shared/locale/localeStorage.js';

const email = 'ana@example.com';
const password = 'LocalTest2026!';
const loginUrl = 'http://localhost:8080/api/v1/auth/login';
// AA03: after sign-in the SPA loads the current roles from GET /auth/me.
const meUrl = 'http://localhost:8080/api/v1/auth/me';
const resumeUrl = 'http://localhost:8080/api/v1/auth/resume';
const healthUrl = 'http://localhost:8080/api/v1/health';

function enterValue(input, value) {
  const { set } = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  );
  set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('local sign-in on the shared authentication screen', () => {
  const originalFetch = globalThis.fetch;
  let container;
  let root;

  beforeEach(async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en-GB');
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid or expired session' },
        }),
      });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    window.history.replaceState(null, '', '/login');
    await act(async () =>
      root.render(
        <AuthProvider>
          <App />
        </AuthProvider>,
      ),
    );
  });

  afterEach(() => {
    localStorage.clear();
    act(() => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  async function submitCredentials() {
    act(() => {
      enterValue(container.querySelector('input[type="email"]'), email);
      enterValue(container.querySelector('input[type="password"]'), password);
    });
    await act(async () =>
      container.querySelector('button[type="submit"]').click(),
    );
    // Let the AA03 /auth/me request (if any) settle.
    await act(async () => {});
    expect(globalThis.fetch).toHaveBeenCalledWith(
      loginUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    );
  }

  it('renders the kiosk login and lets the user reveal and hide the password', () => {
    const passwordInput = container.querySelector('#login-password');
    expect(container.querySelector('.login-kiosk')).not.toBeNull();
    expect(passwordInput.type).toBe('password');
    expect(
      container.querySelector('button[aria-label="Show password"]'),
    ).not.toBeNull();

    act(() =>
      container.querySelector('button[aria-label="Show password"]').click(),
    );
    expect(passwordInput.type).toBe('text');
    expect(
      container.querySelector('button[aria-label="Hide password"]'),
    ).not.toBeNull();

    act(() =>
      container.querySelector('button[aria-label="Hide password"]').click(),
    );
    expect(passwordInput.type).toBe('password');
  });

  it('opens the shared session panel and returns to sign-in on UI logout', async () => {
    expect(container.textContent).toContain('Continue with Google');
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'test-token',
        csrfToken: 'test-csrf-token',
        idleTimeoutSeconds: 600,
        activityReportIntervalSeconds: 30,
        hasLocalCredential: true,
        user: { name: 'Ana', email, roles: ['CUSTOMER'] },
      }),
    });
    // AA03: the session is built from GET /auth/me, not from the login answer.
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'USR-00001',
        name: 'Ana',
        email,
        roles: ['CUSTOMER'],
        active: true,
        marketingConsent: false,
        createdAt: '2026-11-10T10:00:00.000Z',
      }),
    });

    await submitCredentials();
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      meUrl,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );

    // Start greets authenticated users; account and logout live in the header.
    expect(container.querySelector('main h1').textContent).toBe('Hello, Ana');
    expect(
      container.querySelector('header a[href="/account"]').textContent,
    ).toBe('Ana');
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({}),
    });
    const logout = container.querySelector(
      'header button[aria-label="Log out"]',
    );
    await act(async () => logout.click());
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('main #start-sections')).not.toBeNull();
    expect(container.querySelector('header a[href="/login"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Hello, Ana');
    expect(container.querySelector('header a[href="/account"]')).toBeNull();
  });

  it('restores the active session after a full page reload', async () => {
    globalThis.fetch = jest.fn((url) => {
      if (url === healthUrl)
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'ok' }),
        });
      if (url === resumeUrl)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'resumed-token',
            csrfToken: 'resumed-csrf',
            idleTimeoutSeconds: 600,
            activityReportIntervalSeconds: 30,
            hasLocalCredential: true,
            user: { name: 'Ana', email, roles: ['CUSTOMER'] },
          }),
        });
      if (url === meUrl)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'USR-00001',
            name: 'Ana',
            email,
            roles: ['CUSTOMER'],
            active: true,
            marketingConsent: false,
            createdAt: '2026-11-10T10:00:00.000Z',
          }),
        });
      throw new Error(`Unexpected request: ${url}`);
    });

    await act(async () => {
      root.unmount();
      root = createRoot(container);
      root.render(
        <AuthProvider>
          <App />
        </AuthProvider>,
      );
    });

    expect(container.querySelector('main h1').textContent).toBe('Hello, Ana');
    expect(container.querySelector('header a[href="/account"]')).not.toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      resumeUrl,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('displays the generic failure and keeps the sign-in form available', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid email or password' } }),
    });

    await submitCredentials();

    expect(container.querySelector('[role="alert"]').textContent).toBe(
      'Invalid email or password.',
    );
    expect(container.querySelector('button[type="submit"]').disabled).toBe(
      false,
    );
    // AA03 (BR 13): a failed sign-in never requests /auth/me.
    expect(globalThis.fetch).not.toHaveBeenCalledWith(meUrl, expect.anything());
    expect(container.textContent).not.toContain('Welcome to LaPrizza');
  });
});
