/** @jest-environment jsdom */
import { act, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/app/App.jsx';
import { OIDC_STATE_KEY } from '../../src/features/authentication/services/session/googleSignIn.js';
import * as appConfig from '../../src/shared/config/appConfig.js';
import { LOCALE_STORAGE_KEY } from '../../src/shared/locale/localeStorage.js';

const originalFetch = globalThis.fetch;
const user = {
  id: 'USR-00001',
  name: 'Ana',
  email: 'ana@example.com',
  active: true,
};
const session = { accessToken: 'access-token' };

const response = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

function enterValue(input, value) {
  const { set } = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  );
  set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function fillPasswordChangeForm(form) {
  act(() => {
    enterValue(form.elements['current-password'], 'CurrentPassword2026!');
    enterValue(form.elements['new-password'], 'NewSecurePassword2026!');
    enterValue(form.elements['confirm-password'], 'NewSecurePassword2026!');
  });
}

let container;
let root;

beforeEach(() => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en-GB');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  sessionStorage.clear();
  localStorage.clear();
  globalThis.fetch = originalFetch;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  jest.restoreAllMocks();
});

async function open(path, modules) {
  window.history.replaceState(null, '', path);
  await act(async () =>
    root.render(
      <StrictMode>
        <App modules={modules} />
      </StrictMode>,
    ),
  );
}

function mockBackend({
  roles,
  localCredential = false,
  fixture = () => response(200, {}),
  // GDP01: GET /customers/me (404 = profile not completed yet).
  customerProfile = () => response(200, {}),
} = {}) {
  globalThis.fetch = jest.fn(async (url, options) => {
    const path = new URL(url).pathname.replace('/api/v1', '');
    if (path === '/health') return response(200, { status: 'ok' });
    if (path === '/auth/resume')
      return roles
        ? response(
            200,
            localCredential
              ? { ...session, csrfToken: 'test-csrf', hasLocalCredential: true }
              : session,
          )
        : response(401);
    if (path === '/auth/me')
      return response(200, {
        ...user,
        roles: typeof roles === 'function' ? roles() : (roles ?? ['CUSTOMER']),
      });
    if (path === '/auth/google/callback') return response(200, session);
    if (path === '/customers/me') return customerProfile();
    if (path === '/auth/password') return fixture(path, options);
    if (path === '/kitchen-configurations/active')
      return fixture(path, options);
    if (path === '/users') return response(200, []);
    if (path.startsWith('/fixture/')) return fixture(path, options);
    throw new Error(`Unexpected request to ${path}`);
  });
}

const viewerPath = '/kitchen/viewer';
const activeViewerPath = '/kitchen-configurations/active';
const loadRealViewer = () =>
  import('../../src/visualization/KitchenViewerPage.jsx');
const requestsTo = (path) =>
  fetch.mock.calls.filter(([url]) => url.endsWith(path));

it.each([
  [undefined, '/login'],
  [['CUSTOMER'], viewerPath],
  [['ADMINISTRATOR'], viewerPath],
])(
  'keeps the real viewer unloaded for a session with roles %j',
  async (roles, expectedPath) => {
    mockBackend({ roles });
    const kitchenViewer = jest.fn(loadRealViewer);
    await open(viewerPath, { kitchenViewer });
    expect(window.location.pathname).toBe(expectedPath);
    expect(kitchenViewer).not.toHaveBeenCalled();
    expect(requestsTo(activeViewerPath)).toHaveLength(0);
    expect(container.querySelector('main').textContent).toContain(
      roles ? 'Access denied' : 'Sign in to LaPrizza',
    );
  },
);

it.each([['EMPLOYEE'], ['MANAGER']])(
  'mounts the real viewer for %s and recognizes the WEB06 404 code',
  async (role) => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    mockBackend({
      roles: [role],
      fixture: () =>
        response(404, {
          error: {
            status: 404,
            message: 'No active kitchen configuration',
            details: [
              {
                path: '',
                code: 'NO_ACTIVE_CONFIGURATION',
                message: 'No active kitchen configuration',
              },
            ],
          },
        }),
    });
    await open(viewerPath, { kitchenViewer: loadRealViewer });
    expect(container.querySelector('header .brand img')?.alt).toBe('LaPrizza');
    expect(container.querySelector('main').textContent).toContain(
      'No kitchen configuration is active.',
    );
    expect(requestsTo(activeViewerPath)).toEqual([
      [
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
          }),
        }),
      ],
    ]);
  },
  15_000,
);

it('lets WEB03 end an expired viewer session without a second request or role refresh', async () => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
  let roleChecksBeforeFailure;
  mockBackend({
    roles: ['MANAGER'],
    fixture: () => {
      roleChecksBeforeFailure = requestsTo('/auth/me').length;
      return response(401);
    },
  });
  await open(viewerPath, { kitchenViewer: loadRealViewer });
  expect(window.location.pathname).toBe('/login');
  expect(window.location.search).toBe('?returnTo=%2Fkitchen%2Fviewer');
  expect(requestsTo(activeViewerPath)).toHaveLength(1);
  expect(requestsTo('/auth/me')).toHaveLength(roleChecksBeforeFailure);
  expect(container.querySelector('main').textContent).not.toContain(
    'Kitchen viewer',
  );
});

it.each([
  { refreshed: ['MANAGER', 'EMPLOYEE'], kept: true },
  { refreshed: ['EMPLOYEE'], kept: true },
  { refreshed: ['CUSTOMER'], kept: false },
])(
  'refreshes viewer roles once on 403 to $refreshed',
  async ({ refreshed, kept }) => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    let roles = ['MANAGER', 'EMPLOYEE'];
    let roleChecksBeforeFailure;
    mockBackend({
      roles: () => roles,
      fixture: () => {
        roleChecksBeforeFailure = requestsTo('/auth/me').length;
        roles = refreshed;
        return response(403);
      },
    });
    await open(viewerPath, {
      kitchenViewer: loadRealViewer,
      kitchenConfigurations: () =>
        import('../../src/features/kitchen-configurations/KitchenConfigurationsModule.jsx'),
    });
    expect(window.location.pathname).toBe(viewerPath);
    expect(requestsTo('/auth/me')).toHaveLength(roleChecksBeforeFailure + 1);
    expect(requestsTo(activeViewerPath)).toHaveLength(1);
    expect(container.querySelector('main h1')?.textContent).toBe(
      kept ? 'Kitchen viewer' : 'Access denied',
    );
    expect(container.querySelector('main').textContent).toContain(
      'You do not have permission',
    );
    expect(
      Boolean(
        container.querySelector('.app-sidebar a[href="/kitchen/viewer"]'),
      ),
    ).toBe(kept);
    expect(
      Boolean(
        container.querySelector(
          '.app-sidebar a[href="/kitchen/configurations"]',
        ),
      ),
    ).toBe(refreshed.includes('MANAGER'));
  },
);

it('shows a configuration error before mounting the shell or calling the API', async () => {
  globalThis.fetch = jest.fn();
  jest.spyOn(appConfig, 'getAppConfig').mockImplementation(() =>
    appConfig.readAppConfig({
      PROD: true,
      VITE_BACKEND_BASE_URL: 'http://api.example.org/api/v1',
    }),
  );

  await open('/');

  expect(container.querySelector('[role=alert]')?.textContent).toBe(
    'The application is not configured correctly.',
  );
  expect(container.querySelector('header')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('clears the Google callback query, posts it once, and navigates to the confirmed session', async () => {
  mockBackend();
  sessionStorage.setItem(OIDC_STATE_KEY, 'matching-state');
  await open('/auth/callback/google?code=one-time-code&state=matching-state');

  expect(window.location.pathname).toBe('/');
  expect(window.location.search).toBe('');
  expect(container.textContent).toContain('Hello, Ana');
  const callbacks = fetch.mock.calls.filter(([url]) =>
    url.endsWith('/auth/google/callback'),
  );
  expect(callbacks).toHaveLength(1);
  expect(JSON.parse(callbacks[0][1].body)).toEqual({
    code: 'one-time-code',
    state: 'matching-state',
  });
});

it('sends a first Google sign-in without a phone number to "My data" (AA02 clarification)', async () => {
  mockBackend({
    customerProfile: () =>
      response(404, { error: { message: 'Customer profile not completed' } }),
  });
  sessionStorage.setItem(OIDC_STATE_KEY, 'matching-state');
  await open('/auth/callback/google?code=one-time-code&state=matching-state');

  expect(window.location.pathname).toBe('/account/privacy');
  expect(window.location.search).toBe('');
});

it('opens an existing deep link and shows a common-shell fallback for unknown paths', async () => {
  mockBackend();
  await open('/register');
  const brand = container.querySelector('header a.brand[href="/"] img');
  expect(brand?.alt).toBe('LaPrizza');
  expect(brand?.getAttribute('src')).toBe('/laprizza-logo.webp');
  expect(container.querySelector('main input[type=email]')).not.toBeNull();
  expect(
    container
      .querySelector('header [aria-current="page"]')
      .getAttribute('href'),
  ).toBe('/register');
  await act(async () => {
    window.history.pushState(null, '', '/unknown');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(container.querySelector('main').textContent).toContain(
    'Page not found',
  );
});

it('shows available sections on Start and opens separate sign-in and registration pages', async () => {
  mockBackend();
  await open('/');

  expect(container.querySelector('main .auth-card')).toBeNull();
  expect(
    [...container.querySelectorAll('main .start-links a')].map((link) =>
      link.getAttribute('href'),
    ),
  ).toEqual(['/catalogue', '/privacy']);

  await act(async () =>
    container.querySelector('header a[href="/login"]').click(),
  );
  expect(window.location.pathname).toBe('/login');
  expect(container.querySelector('main .login-kiosk h1').textContent).toBe(
    'Sign in to LaPrizza',
  );

  await act(async () =>
    container.querySelector('header a[href="/register"]').click(),
  );
  expect(window.location.pathname).toBe('/register');
  expect(container.querySelector('main h1').textContent).toBe('Create account');
});

it('keeps a legacy recovery link in memory while cleaning it from the URL', async () => {
  mockBackend();
  await open('/?recoveryToken=one-time-link');
  expect(container.querySelector('h1').textContent).toBe(
    'Choose a new password',
  );
  expect(window.location.search).toBe('');
  await act(async () =>
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Back to sign in')
      .click(),
  );
  expect(window.location.pathname).toBe('/login');
  expect(container.querySelector('main .login-kiosk h1').textContent).toContain(
    'Sign in',
  );
});

it('returns to Start from the legacy recovery screen after scrubbing its URL', async () => {
  mockBackend();
  await open('/?recoveryToken=one-time-link');
  expect(container.querySelector('h1').textContent).toBe(
    'Choose a new password',
  );
  expect(window.location.search).toBe('');
  await act(async () => container.querySelector('header a.brand').click());
  expect(container.querySelector('main .auth-card')).toBeNull();
  expect(window.location.pathname).toBe('/');
  expect(container.querySelector('main #start-sections')).not.toBeNull();
  // A Guest's side menu has only the public sections (WEB03 BR 4).
  expect(
    [...container.querySelectorAll('.app-sidebar [data-section-link]')].map(
      (link) => link.getAttribute('href'),
    ),
  ).toEqual(['/catalogue', '/privacy']);
});

it.each([
  ['ADMINISTRATOR', true],
  ['CUSTOMER', false],
])(
  'shows the administration link and guards direct entry (%s)',
  async (role, allowed) => {
    mockBackend({ roles: [role] });
    await open('/');

    expect(container.querySelector('main #admin-users-title')).toBeNull();
    expect(
      fetch.mock.calls.some(
        ([url]) => new URL(url).pathname === '/api/v1/users',
      ),
    ).toBe(false);
    const adminLink = container.querySelector(
      '.app-sidebar a[href="/admin/users"]',
    );
    expect(Boolean(adminLink)).toBe(allowed);
    await act(async () => {
      if (adminLink) adminLink.click();
      else {
        window.history.pushState(null, '', '/admin/users');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
    expect(Boolean(container.querySelector('main #admin-users-title'))).toBe(
      allowed,
    );
    const userRequests = fetch.mock.calls.filter(
      ([url]) => new URL(url).pathname === '/api/v1/users',
    );
    if (!allowed) {
      expect(userRequests).toHaveLength(0);
      expect(container.querySelector('main h1').textContent).toBe(
        'Access denied',
      );
      expect(container.querySelector('.app-sidebar [aria-current]')).toBeNull();
      return;
    }
    expect(container.querySelector('.app-sidebar [aria-current="page"]')).toBe(
      adminLink,
    );
    expect(document.activeElement).toBe(container.querySelector('main h1'));
    expect(userRequests[0]).toEqual([
      'http://localhost:8080/api/v1/users?includeInactive=true',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    ]);
  },
);

it('uses the account link for the existing password change flow', async () => {
  mockBackend({ roles: ['CUSTOMER'], localCredential: true });
  await open('/');
  const accountLink = container.querySelector('header a[href="/account"]');
  await act(async () => accountLink.click());
  expect(container.querySelector('header [aria-current="page"]')).toBe(
    accountLink,
  );

  await act(async () =>
    [...container.querySelectorAll('main button')]
      .find((button) => button.textContent === 'Change password')
      .click(),
  );
  expect(window.location.pathname).toBe('/account/password');
  expect(container.querySelector('main h1').textContent).toBe(
    'Change password',
  );
  expect(container.querySelector('header [aria-current="location"]')).toBe(
    accountLink,
  );

  await act(async () =>
    [...container.querySelectorAll('main button')]
      .find((button) => button.textContent === 'Back to account')
      .click(),
  );
  expect(window.location.pathname).toBe('/account');
  expect(container.querySelector('header [aria-current="page"]')).toBe(
    accountLink,
  );
});

it('shows password-change confirmation on the sign-in page after logout', async () => {
  mockBackend({
    roles: ['CUSTOMER'],
    localCredential: true,
    fixture: () => response(204),
  });
  await open('/account/password');

  const form = container.querySelector('main form');
  fillPasswordChangeForm(form);

  await act(async () => form.querySelector('[type="submit"]').click());

  expect(window.location.pathname).toBe('/account/password');
  expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain(
    'Your password will change and your session will end.',
  );
  expect(
    fetch.mock.calls.some(
      ([url]) => new URL(url).pathname === '/api/v1/auth/password',
    ),
  ).toBe(false);

  await act(async () =>
    container
      .querySelector('[role="alertdialog"] .button--danger')
      .click(),
  );

  expect(window.location.pathname).toBe('/login');
  expect(container.querySelector('main [role="status"]')?.textContent).toBe(
    'Your password has been changed. Sign in with your new password.',
  );
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8080/api/v1/auth/password',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        currentPassword: 'CurrentPassword2026!',
        newPassword: 'NewSecurePassword2026!',
      }),
    }),
  );
});

it('cancels password-change confirmation without losing the form or sending a request', async () => {
  mockBackend({ roles: ['CUSTOMER'], localCredential: true });
  await open('/account/password');

  const form = container.querySelector('main form');
  fillPasswordChangeForm(form);
  await act(async () => form.querySelector('[type="submit"]').click());
  expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

  await act(async () =>
    container
      .querySelector('[role="alertdialog"] .button--secondary')
      .click(),
  );

  expect(window.location.pathname).toBe('/account/password');
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  expect(form.elements['current-password'].value).toBe('CurrentPassword2026!');
  expect(form.elements['new-password'].value).toBe('NewSecurePassword2026!');
  expect(form.elements['confirm-password'].value).toBe(
    'NewSecurePassword2026!',
  );
  expect(
    fetch.mock.calls.some(
      ([url]) => new URL(url).pathname === '/api/v1/auth/password',
    ),
  ).toBe(false);
});

it('opens a declared nested module route and marks its parent link', async () => {
  mockBackend({ roles: ['MANAGER'] });
  await open('/kitchen/configurations/123', {
    kitchenConfigurations: async () => ({
      default: () => <h1>Configuration details</h1>,
    }),
  });

  expect(document.activeElement.textContent).toBe('Configuration details');
  expect(
    container
      .querySelector('.app-sidebar [aria-current="location"]')
      .getAttribute('href'),
  ).toBe('/kitchen/configurations');

  await act(async () => {
    window.history.pushState(null, '', '/kitchen/configurations/123/unknown');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(container.querySelector('main h1').textContent).toBe('Page not found');
  expect(container.querySelector('.app-sidebar [aria-current]')).toBeNull();
});

it.each([
  ['/kitchen/viewer', 'kitchenViewer', ['EMPLOYEE'], 'GET'],
  ['/kitchen/viewer', 'kitchenViewer', ['MANAGER'], 'GET'],
  ['/planning', 'planning', ['MANAGER'], 'POST'],
])(
  'mounts %s in the same shell and uses the confirmed session',
  async (path, id, roles, method) => {
    mockBackend({ roles });
    function Fixture({ request }) {
      useEffect(() => {
        void request(
          method,
          '/fixture/PROD-00123',
          method === 'POST' ? { body: { productId: 'PROD-00123' } } : undefined,
        );
      }, [request]);
      return <h1>Integration fixture</h1>;
    }
    await open(path, { [id]: async () => ({ default: Fixture }) });

    expect(container.querySelector('header .brand img')?.alt).toBe('LaPrizza');
    expect(container.querySelector('main').textContent).toContain(
      'Integration fixture',
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/fixture/PROD-00123',
      expect.objectContaining({
        method,
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
        ...(method === 'POST' ? { body: '{"productId":"PROD-00123"}' } : {}),
      }),
    );
  },
);

it('redirects a Guest from a protected module to sign-in with only the path as returnTo (WEB03 FT03)', async () => {
  mockBackend();
  const load = jest.fn();
  await open('/kitchen/viewer?secret=x#y', { kitchenViewer: load });
  expect(load).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe('/login');
  expect(window.location.search).toBe('?returnTo=%2Fkitchen%2Fviewer');
  expect(container.querySelector('main h1').textContent).toBe(
    'Sign in to LaPrizza',
  );
});

it.each([
  ['/planning', 'planning', ['EMPLOYEE']],
  ['/kitchen/configurations/123', 'kitchenConfigurations', ['EMPLOYEE']],
  ['/planning', 'planning', ['ADMINISTRATOR']],
])(
  'keeps protected modules unmounted for %s with roles %j',
  async (path, id, roles) => {
    mockBackend({ roles });
    const load = jest.fn();
    await open(path, { [id]: load });
    expect(load).not.toHaveBeenCalled();
    expect(container.querySelector('main').textContent).toContain(
      'Access denied',
    );
  },
);

it('rechecks permissions after a 403 and keeps the roles the user still has', async () => {
  let roles = ['MANAGER', 'CUSTOMER'];
  mockBackend({
    roles: () => roles,
    fixture: () => {
      roles = ['CUSTOMER'];
      return response(403);
    },
  });
  function Fixture({ request }) {
    useEffect(() => {
      void request('GET', '/fixture/planning').catch(() => {});
    }, [request]);
    return <h1>Manager-only page</h1>;
  }
  await open('/planning', { planning: async () => ({ default: Fixture }) });
  expect(container.querySelector('main').textContent).toContain(
    'Access denied',
  );
  expect(container.querySelector('main').textContent).not.toContain(
    'Manager-only page',
  );
  // The remaining CUSTOMER role keeps the public sections, My data and Documents.
  expect(
    [...container.querySelectorAll('.app-sidebar [data-section-link]')].map(
      (link) => link.getAttribute('href'),
    ),
  ).toEqual(['/catalogue', '/privacy', '/account/privacy', '/documents']);
  await act(async () => container.querySelector('header a').click());
  expect(container.querySelector('main').textContent).toContain('Hello, Ana');
});

it('contains a rejected lazy load inside the shell and can retry the loader', async () => {
  mockBackend({ roles: ['EMPLOYEE'] });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const load = jest
    .fn()
    .mockRejectedValueOnce(new Error('Unable to load module'))
    .mockResolvedValueOnce({ default: () => <h1>Viewer recovered</h1> });
  await open('/kitchen/viewer', { kitchenViewer: load });
  expect(container.querySelector('header .brand img')?.alt).toBe('LaPrizza');
  expect(container.querySelector('main [role=alert]').textContent).toContain(
    'This section could not be loaded.',
  );
  await act(async () => container.querySelector('main button').click());
  expect(container.querySelector('main').textContent).toContain(
    'Viewer recovered',
  );
  expect(load).toHaveBeenCalledTimes(2);
});

it('contains a module render error and recovers without remounting the header', async () => {
  mockBackend({ roles: ['EMPLOYEE'] });
  jest.spyOn(console, 'error').mockImplementation(() => {});

  function BrokenViewer() {
    throw new Error('WebGL unavailable');
  }

  const load = jest
    .fn()
    .mockResolvedValueOnce({ default: BrokenViewer })
    .mockResolvedValueOnce({ default: () => <h1>Viewer recovered</h1> });
  await open('/kitchen/viewer', { kitchenViewer: load });

  const header = container.querySelector('header');
  expect(header).not.toBeNull();
  expect(header.querySelector('a.brand[href="/"]')).not.toBeNull();
  expect(load).toHaveBeenCalledTimes(1);
  expect(container.querySelector('main [role=alert]')?.textContent).toBe(
    'This section could not be loaded.',
  );
  const retry = container.querySelector('main button');
  expect(retry?.textContent).toBe('Try again');
  await act(async () => retry.click());

  expect(load).toHaveBeenCalledTimes(2);
  expect(container.querySelector('main h1')?.textContent).toBe(
    'Viewer recovered',
  );
  expect(container.querySelector('main [role=alert]')).toBeNull();
  expect(container.querySelector('header')).toBe(header);
});

it('restores the language across visits and translates the same unsaved form and error', async () => {
  mockBackend();
  localStorage.setItem(LOCALE_STORAGE_KEY, 'fr-FR');
  await open('/register');

  expect(document.documentElement.lang).toBe('pt-PT');
  expect(container.querySelector('h1').textContent).toBe('Criar conta');
  const email = container.querySelector('#registration-email');
  email.value = 'ana@example.com';
  const consent = container.querySelector('[name=marketingConsent]');
  await act(async () => consent.click());
  await act(async () => container.querySelector('button[type=submit]').click());
  const error = container.querySelector('#registration-name-error');
  expect(error.textContent).toBe('Preencha este campo.');
  expect(
    container.querySelector('#registration-name').getAttribute('aria-invalid'),
  ).toBe('true');
  expect(
    container
      .querySelector('#registration-name')
      .getAttribute('aria-describedby'),
  ).toBe(error.id);

  const languageButton = container.querySelector(
    '[data-language-choice="en-GB"]',
  );
  languageButton.focus();
  const requestCount = fetch.mock.calls.length;
  await act(async () => {
    languageButton.click();
  });

  expect(document.activeElement).toBe(languageButton);
  expect(languageButton.getAttribute('aria-pressed')).toBe('true');
  expect(document.documentElement.lang).toBe('en-GB');
  expect(document.title).toBe('Create account · LaPrizza');
  expect(container.querySelector('#registration-email')).toBe(email);
  expect(email.value).toBe('ana@example.com');
  expect(consent.checked).toBe(true);
  expect(error.textContent).toBe('Fill in this field.');
  expect(fetch).toHaveBeenCalledTimes(requestCount);
  expect(window.location.pathname).toBe('/register');

  await act(async () => container.querySelector('header a.brand').click());
  expect(container.querySelector('main .auth-card')).toBeNull();
  expect(container.querySelector('main #start-sections')).not.toBeNull();
  expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en-GB');

  act(() => root.unmount());
  root = createRoot(container);
  await open('/register');
  expect(container.querySelector('h1').textContent).toBe('Create account');
  expect(
    container
      .querySelector('[data-language-choice="en-GB"]')
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

it('applies the selected language in memory if the browser cannot save it', async () => {
  mockBackend();
  await open('/');
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable');
  });
  const languageButton = container.querySelector(
    '[data-language-choice="pt-PT"]',
  );
  await act(async () => {
    languageButton.click();
  });
  expect(document.documentElement.lang).toBe('pt-PT');
  expect(container.querySelector('.locale-notice').textContent).toMatch(
    /não pôde ser guardado/,
  );
});

it('marks the rendered section only after the guard and lazy view settle', async () => {
  mockBackend({ roles: ['MANAGER'] });
  let resolveViewer;
  const viewer = new Promise((resolve) => {
    resolveViewer = resolve;
  });
  await open('/kitchen/viewer', {
    kitchenViewer: () => viewer,
    planning: async () => ({ default: () => <h1>Planning fixture</h1> }),
  });
  const menu = container.querySelector('.app-sidebar');
  expect(container.querySelector('main').textContent).toContain(
    'Loading section',
  );
  expect(menu.querySelector('[aria-current]')).toBeNull();

  await act(async () =>
    resolveViewer({ default: () => <h1>Viewer fixture</h1> }),
  );
  expect(menu.querySelector('[aria-current=page]').getAttribute('href')).toBe(
    '/kitchen/viewer',
  );
  expect(document.activeElement).toBe(container.querySelector('main h1'));
  expect(document.title).toBe('Kitchen viewer · LaPrizza');

  await act(async () => menu.querySelector('a[href="/planning"]').click());
  expect(menu.querySelector('[aria-current=page]').getAttribute('href')).toBe(
    '/planning',
  );
  expect(document.activeElement.textContent).toBe('Planning fixture');
  await act(async () => {
    window.history.replaceState(null, '', '/unknown');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(menu.querySelector('[aria-current]')).toBeNull();
  expect(document.activeElement.textContent).toBe('Page not found');
  expect(container.querySelector('.app-sidebar')).toBe(menu);
  await act(async () => container.querySelector('.skip-link').click());
  expect(document.activeElement).toBe(container.querySelector('main'));
  await act(async () => container.querySelector('main a[href="/"]').click());
  expect(menu.querySelector('[aria-current=page]').getAttribute('href')).toBe(
    '/',
  );
  expect(
    container.querySelector('main .start-links a[href="/planning"]'),
  ).not.toBeNull();
});
