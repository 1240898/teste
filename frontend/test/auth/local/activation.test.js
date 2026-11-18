/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../../src/app/App.jsx';
import { ACTIVATION_STATE_KEY } from '../../../src/features/authentication/services/activationApi.js';
import { LOCALE_STORAGE_KEY } from '../../../src/shared/locale/localeStorage.js';

const originalFetch = globalThis.fetch;
const token = 'a'.repeat(43);
let container;
let root;

const json = (body, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

const existingUser = {
  id: 'USR-00001',
  name: 'Existing Administrator',
  email: 'existing@example.test',
  roles: ['ADMINISTRATOR'],
  active: true,
};

function withExistingSession(handleActivation) {
  return jest.fn(async (url, options) => {
    if (url.endsWith('/auth/resume')) {
      return json({
        accessToken: 'existing-session',
        csrfToken: 'existing-csrf',
        idleTimeoutSeconds: 600,
        activityReportIntervalSeconds: 30,
        idleExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      });
    }
    if (url.endsWith('/auth/me')) return json(existingUser);
    if (url.endsWith('/auth/logout')) return { ok: true, status: 204 };
    if (url.endsWith('/health')) return json({ status: 'ok' });
    return handleActivation(url, options);
  });
}

beforeEach(() => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en-GB');
  window.history.replaceState(null, '', `/activate?activationToken=${token}`);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.body.appendChild(document.createElement('div'));
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  sessionStorage.clear();
  globalThis.fetch = originalFetch;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  window.history.replaceState(null, '', '/');
});

it('keeps the existing session until the recipient explicitly switches accounts after local activation', async () => {
  globalThis.fetch = withExistingSession((url) => {
    if (url.endsWith('/activation/inspect')) return json({ method: 'LOCAL' });
    if (url.endsWith('/activation/local')) return json({ nextSignIn: 'LOCAL' });
    return json({}, 404);
  });
  await act(async () => root.render(<App />));
  await act(async () => container.querySelector('main form button').click());
  expect(window.location.pathname).toBe('/activate');
  expect(container.querySelector('main').textContent).toContain(
    existingUser.email,
  );
  expect(container.querySelector('main a[href="/login"]')).toBeNull();
  expect(
    globalThis.fetch.mock.calls.some(([url]) => url.endsWith('/auth/logout')),
  ).toBe(false);

  const switchAccount = [...container.querySelectorAll('main button')].find(
    (button) => button.textContent === 'Sign out and use another account',
  );
  await act(async () => switchAccount.click());
  expect(
    globalThis.fetch.mock.calls.some(([url]) => url.endsWith('/auth/logout')),
  ).toBe(true);
  expect(window.location.pathname).toBe('/login');
  expect(container.querySelector('main input[type="password"]')).not.toBeNull();
});

it('leaves the administrator signed in when Google activation fails', async () => {
  window.history.replaceState(
    null,
    '',
    '/auth/callback/google?code=failed&state=activation-state',
  );
  sessionStorage.setItem(ACTIVATION_STATE_KEY, 'activation-state');
  globalThis.fetch = withExistingSession((url) =>
    url.endsWith('/activation/external/complete')
      ? json({ error: { message: 'External authentication failed' } }, 401)
      : json({}, 404),
  );
  await act(async () => root.render(<App />));
  expect(container.querySelector('main [role="alert"]').textContent).toContain(
    'Google identity verification failed',
  );
  expect(container.querySelector('.header-account__name').textContent).toBe(
    existingUser.name,
  );
  expect(
    globalThis.fetch.mock.calls.some(([url]) => url.endsWith('/auth/logout')),
  ).toBe(false);
});

it('clears the invitation link, asks for a first password only when required, and offers normal sign-in', async () => {
  const attempts = [];
  globalThis.fetch = jest.fn(async (url, options) => {
    if (url.endsWith('/activation/inspect')) {
      expect(JSON.parse(options.body)).toEqual({ token });
      return json({ method: 'LOCAL' });
    }
    if (url.endsWith('/activation/local')) {
      const body = JSON.parse(options.body);
      attempts.push(body);
      return body.password
        ? json({ nextSignIn: 'LOCAL' })
        : json(
            {
              error: {
                message: 'Password is required to activate this account.',
              },
            },
            400,
          );
    }
    return url.endsWith('/health') ? json({ status: 'ok' }) : json({}, 401);
  });
  await act(async () => root.render(<App />));
  expect(window.location.search).toBe('');
  expect(container.querySelector('#activation-password')).toBeNull();
  const confirm = () =>
    container.querySelector('form button[type="submit"]').click();
  await act(async () => confirm());
  const input = container.querySelector('#activation-password');
  input.value = 'Activation-Test42!';
  await act(async () => confirm());
  expect(attempts).toEqual([
    { token },
    { token, password: 'Activation-Test42!' },
  ]);
  expect(container.querySelector('main [role="status"]').textContent).toContain(
    'Your account is active',
  );
  expect(container.querySelector('main a[href="/login"]')).not.toBeNull();
});
