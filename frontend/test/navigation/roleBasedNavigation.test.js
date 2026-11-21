/** @jest-environment jsdom */
import { act, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { jest } from '@jest/globals';
import App from '../../src/app/App.jsx';
import { LOCALE_STORAGE_KEY } from '../../src/shared/locale/localeStorage.js';

// WEB03 functional tests (usWEB03.md, section 4.1): the whole SPA with the real
// AuthProvider, router, apiClient and global 401/403 handler; only fetch is
// replaced by a programmable back end.

const originalFetch = globalThis.fetch;
const user = {
  id: 'USR-00001',
  name: 'Ana',
  email: 'ana@example.com',
  active: true,
};

const response = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});
const error = (status, message) =>
  response(status, { error: { message, status } });

let container;
let root;
let backend;

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
  jest.useRealTimers();
});

/**
 * roles: initial roles (undefined = no session to resume, i.e. Guest).
 * me: optional function returning the next /auth/me answer.
 * business: answer for any /fixture/* request.
 */
function mockBackend({ roles, me, business = () => response(200, {}) } = {}) {
  backend = { roles, meCalls: 0, businessCalls: 0 };
  globalThis.fetch = jest.fn(async (url) => {
    const path = new URL(url).pathname.replace('/api/v1', '');
    if (path === '/health') return response(200, { status: 'ok' });
    if (path === '/auth/resume')
      return backend.roles
        ? response(200, { accessToken: 'access-token' })
        : error(401, 'No token provided');
    if (path === '/auth/me') {
      backend.meCalls += 1;
      if (backend.nextMe) return backend.nextMe();
      if (me) return me(backend.meCalls);
      return response(200, { ...user, roles: backend.roles });
    }
    if (path === '/security/audit-logs')
      return response(200, { items: [], total: 0, limit: 25, offset: 0 });
    if (path === '/shared-resources')
      return response(200, { items: [{ name: 'Example.txt' }] });
    if (path.startsWith('/fixture/')) {
      backend.businessCalls += 1;
      return business(path);
    }
    throw new Error(`Unexpected request to ${path}`);
  });
}

async function open(path, modules = {}) {
  window.history.replaceState(null, '', path);
  await act(async () =>
    root.render(
      <StrictMode>
        <App modules={modules} />
      </StrictMode>,
    ),
  );
}

async function settle() {
  for (let i = 0; i < 5; i += 1) await act(async () => {});
}

// Section entries in the header corner (account / registration) and in the
// side menu, in page order. The Start link is not a section.
const menuLinks = () =>
  [...container.querySelectorAll('[data-section-link]')].map((link) =>
    link.getAttribute('href'),
  );
const main = () => container.querySelector('main').textContent;
// Public sections (Table 1) shown in the side menu for every status.
const PUBLIC_LINKS = ['/catalogue', '/privacy'];
const SIGNED_IN_LINKS = ['/account', ...PUBLIC_LINKS, '/documents'];
const CUSTOMER_LINKS = ['/account', ...PUBLIC_LINKS, '/account/privacy', '/documents'];

const outcomes = [];
// A module page whose button sends `count` business requests at the same time.
function fixtureModule(count = 1) {
  function Fixture({ request }) {
    const [result, setResult] = useState('idle');
    async function send() {
      const results = await Promise.allSettled(
        Array.from({ length: count }, (_, i) =>
          request('POST', `/fixture/operation-${i}`, { body: { i } }),
        ),
      );
      outcomes.push(...results.map((r) => r.reason?.status ?? 'ok'));
      setResult(
        results.every((r) => r.status === 'fulfilled')
          ? 'Operation completed'
          : 'Operation failed',
      );
    }
    return (
      <section>
        <h1>Planning fixture</h1>
        <button type="button" onClick={send}>
          Send
        </button>
        <p>{result}</p>
      </section>
    );
  }
  return { planning: async () => ({ default: Fixture }) };
}

async function clickSend() {
  await act(async () =>
    [...container.querySelectorAll('main button')]
      .find((button) => button.textContent === 'Send')
      .click(),
  );
  await settle();
}

const allModules = {
  kitchenViewer: async () => ({ default: () => <h1>Viewer fixture</h1> }),
  kitchenConfigurations: async () => ({
    default: () => <h1>Configurations fixture</h1>,
  }),
  planning: async () => ({ default: () => <h1>Planning fixture</h1> }),
};

beforeEach(() => {
  outcomes.length = 0;
});

describe('WEB03 role-based navigation (SPA)', () => {
  test.each([
    [undefined, ['/register', ...PUBLIC_LINKS]],
    [['CUSTOMER'], CUSTOMER_LINKS],
    [['EMPLOYEE'], [...SIGNED_IN_LINKS, '/kitchen/viewer']],
    [
      ['MANAGER'],
      [
        ...SIGNED_IN_LINKS,
        '/kitchen/viewer',
        '/kitchen/configurations',
        '/planning',
      ],
    ],
    [
      ['ADMINISTRATOR'],
      [...SIGNED_IN_LINKS, '/admin/users', '/admin/security-audit'],
    ],
    [
      ['CUSTOMER', 'MANAGER'],
      [
        ...CUSTOMER_LINKS,
        '/kitchen/viewer',
        '/kitchen/configurations',
        '/planning',
      ],
    ],
    [
      ['ADMINISTRATOR', 'EMPLOYEE'],
      [
        ...SIGNED_IN_LINKS,
        '/kitchen/viewer',
        '/admin/users',
        '/admin/security-audit',
      ],
    ],
  ])('FT01: roles %j see only %j in the menu', async (roles, expected) => {
    mockBackend({ roles });
    await open('/', allModules);
    expect(menuLinks()).toEqual(expected);
  });

  test.each([['CUSTOMER', false], ['ADMINISTRATOR', true]])(
    'SYS04: %s can list documents and management controls are visible: %s',
    async (role, canManage) => {
      mockBackend({ roles: [role] });
      await open('/documents');
      await settle();
      expect(main()).toContain('Example.txt');
      expect(main()).toContain('Download');
      expect(Boolean(container.querySelector('main input[type="file"]'))).toBe(canManage);
    },
  );

  test('SYS04: a guest opening the documents page is sent to sign in', async () => {
    mockBackend();
    await open('/documents');
    expect(window.location.pathname).toBe('/login');
    expect(fetch.mock.calls.some(([url]) => new URL(url).pathname.endsWith('/shared-resources'))).toBe(false);
  });

  test.each([
    ['ADMINISTRATOR', true],
    ['MANAGER', false],
    ['EMPLOYEE', false],
    ['CUSTOMER', false],
  ])('FT-AA05: direct audit URL access for %s is %s', async (role, allowed) => {
    mockBackend({ roles: [role] });
    await open('/admin/security-audit');
    await settle();

    if (allowed) {
      expect(main()).toContain('Security audit logs');
      expect(backend.businessCalls).toBe(0);
      expect(
        fetch.mock.calls.some(([url]) =>
          new URL(url).pathname.endsWith('/security/audit-logs'),
        ),
      ).toBe(true);
    } else {
      expect(main()).toContain('Access denied');
      expect(main()).not.toContain('Security audit logs');
      expect(
        fetch.mock.calls.some(([url]) =>
          new URL(url).pathname.endsWith('/security/audit-logs'),
        ),
      ).toBe(false);
    }
  });

  test('FT02: a role removed elsewhere disappears from the menu when the window regains focus, without reload', async () => {
    mockBackend({ roles: ['CUSTOMER', 'MANAGER'] });
    await open('/', allModules);
    expect(menuLinks()).toContain('/planning');

    backend.roles = ['CUSTOMER'];
    await act(async () => window.dispatchEvent(new Event('focus')));
    await settle();

    expect(menuLinks()).toEqual(CUSTOMER_LINKS);
  });

  test.each([['CUSTOMER'], ['EMPLOYEE'], ['ADMINISTRATOR']])(
    'FT04/FT07: %s typing /planning gets a generic access-denied page; the module is never loaded',
    async (role) => {
      mockBackend({ roles: [role] });
      const load = jest.fn();
      await open('/planning', { planning: load });

      expect(load).not.toHaveBeenCalled();
      expect(backend.businessCalls).toBe(0);
      expect(container.querySelector('main h1').textContent).toBe(
        'Access denied',
      );
      expect(main()).toContain(
        'You do not have permission to access this page.',
      );
      // No section data, required roles or user roles are revealed (AC 3).
      expect(main()).not.toMatch(
        /Planning|Manager|MANAGER|Customer|Staff|Administrator/,
      );
      expect(container.querySelector('main a[href="/"]')).not.toBeNull();
    },
  );

  test('FT06: /auth/me answering 403 during the navigation check shows the account message and mounts nothing', async () => {
    mockBackend({
      roles: ['MANAGER'],
      me: (call) =>
        call === 1
          ? response(200, { ...user, roles: ['MANAGER'] })
          : error(403, 'Account is not active'),
    });
    const load = jest.fn();
    await open('/planning', { planning: load });
    await settle();

    expect(load).not.toHaveBeenCalled();
    expect(main()).toContain('Account is not active.');
    // A denied account sees only the public entries.
    expect(menuLinks()).toEqual(PUBLIC_LINKS);
  });

  test('FT09: a business 403 after a role removal rebuilds the menu and replaces the page', async () => {
    mockBackend({
      roles: ['CUSTOMER', 'MANAGER'],
      business: () => {
        backend.roles = ['CUSTOMER'];
        return error(403, 'Forbidden: insufficient permissions');
      },
    });
    await open('/planning', fixtureModule());
    const meBefore = backend.meCalls;

    await clickSend();

    expect(backend.meCalls - meBefore).toBe(1);
    expect(main()).toContain('You do not have permission to access this page.');
    expect(main()).not.toContain('Planning fixture');
    expect(menuLinks()).toEqual(CUSTOMER_LINKS);
    expect(outcomes).toEqual([403]);
  });

  test('FT10: a business 403 with unchanged roles keeps the page and reports the failure', async () => {
    mockBackend({
      roles: ['MANAGER'],
      business: () => error(403, 'Forbidden: insufficient permissions'),
    });
    await open('/planning', fixtureModule());
    const meBefore = backend.meCalls;

    await clickSend();

    expect(backend.meCalls - meBefore).toBe(1);
    expect(main()).toContain('Planning fixture');
    expect(main()).toContain('Operation failed');
    expect(main()).not.toContain('Operation completed');
    expect(backend.businessCalls).toBe(1);
  });

  test('FT11/FT16: a business 401 ends the session with NO /auth/me request and no retry', async () => {
    mockBackend({
      roles: ['MANAGER'],
      business: () => error(401, 'Invalid or expired token'),
    });
    await open('/planning', fixtureModule());
    const meBefore = backend.meCalls;

    await clickSend();

    expect(backend.meCalls - meBefore).toBe(0);
    expect(backend.businessCalls).toBe(1);
    expect(window.location.pathname).toBe('/login');
    expect(window.location.search).toBe('?returnTo=%2Fplanning');
    expect(main()).toContain('Your session expired. Please sign in again.');
    expect(menuLinks()).toEqual(['/register', ...PUBLIC_LINKS]);
  });

  test('FT14: /auth/me answering 401 during the 403 refresh ends the flow: exactly one /auth/me, no recursion', async () => {
    mockBackend({
      roles: ['MANAGER'],
      business: () => error(403, 'Forbidden: insufficient permissions'),
    });
    await open('/planning', fixtureModule());
    await settle();
    const meBefore = backend.meCalls;
    const fetchBefore = fetch.mock.calls.length;
    backend.nextMe = () => error(401, 'Invalid or expired token');

    await clickSend();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
    await settle();

    expect(backend.meCalls - meBefore).toBe(1);
    // business request + one /auth/me; nothing else afterwards.
    expect(fetch.mock.calls.length - fetchBefore).toBe(2);
    expect(window.location.pathname).toBe('/login');
    expect(menuLinks()).toEqual(['/register', ...PUBLIC_LINKS]);
  });

  test('FT15/FT17: three simultaneous 403s and /auth/me answering 403 cause exactly ONE /auth/me request', async () => {
    mockBackend({
      roles: ['MANAGER'],
      business: () => error(403, 'Forbidden: insufficient permissions'),
    });
    await open('/planning', fixtureModule(3));
    await settle();
    const meBefore = backend.meCalls;
    backend.nextMe = () => error(403, 'Account is not active');

    await clickSend();

    expect(backend.businessCalls).toBe(3);
    expect(backend.meCalls - meBefore).toBe(1);
    expect(outcomes).toEqual([403, 403, 403]);
    expect(main()).toContain('Account is not active.');
    expect(main()).not.toContain('Planning fixture');
  });

  test.each([
    ['/planning', ['MANAGER'], '/planning', 'Planning fixture'],
    ['/planning', ['CUSTOMER'], '/planning', 'Access denied'],
    ['//evil.example', ['MANAGER'], '/', 'Hello, Ana'],
    ['https://evil.example/x', ['MANAGER'], '/', 'Hello, Ana'],
    ['/register', ['MANAGER'], '/', 'Hello, Ana'],
  ])(
    'FT13: after sign-in, returnTo=%s with roles %j leads to %s',
    async (returnTo, roles, expectedPath, expectedText) => {
      mockBackend({ roles });
      await open(`/login?returnTo=${encodeURIComponent(returnTo)}`, allModules);
      await settle();

      expect(window.location.pathname).toBe(expectedPath);
      expect(window.location.search).toBe('');
      expect(main()).toContain(expectedText);
    },
  );
});
