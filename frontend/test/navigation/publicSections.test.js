/** @jest-environment jsdom */
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { jest } from '@jest/globals';
import App from '../../src/app/App.jsx';
import { LOCALE_STORAGE_KEY } from '../../src/shared/locale/localeStorage.js';

// WEB03 AC 4 / BR 4 (usWEB03.md, FT18, FT20–FT24): the public sections of Table 1
// (catalogue with product / allergen information, privacy notice) work in the
// running SPA for Guest and for signed-in users. Only fetch is replaced.

const originalFetch = globalThis.fetch;
const user = { id: 'USR-00001', name: 'Ana', email: 'ana@example.com' };

const response = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});
const error = (status, message) =>
  response(status, { error: { message, status } });

const eur = (amount) => ({ amount, currency: 'EUR' });
const water = {
  id: 'PROD-00001',
  name: 'Water',
  description: 'Still water 50 cl',
  available: true,
  category: { id: 'CAT-00001', name: 'Drinks' },
  price: eur('1.50'),
  allergens: [],
  pizza: null,
};
const margherita = {
  id: 'PROD-00010',
  name: 'Margherita',
  description: 'Tomato and mozzarella',
  available: true,
  category: { id: 'CAT-00002', name: 'Pizzas' },
  price: null,
  allergens: [
    { id: 'ALG-00001', name: 'Gluten' },
    { id: 'ALG-00002', name: 'Milk' },
  ],
  pizza: {
    defaultComponents: [
      { id: 'PROD-00020', name: 'Mozzarella', pizzaComponentTypeId: 'PCT-1' },
    ],
    sizes: [
      {
        sizeId: 'SIZE-L',
        sizeName: 'Large',
        price: eur('12.00'),
        available: false,
      },
      {
        sizeId: 'SIZE-M',
        sizeName: 'Medium',
        price: eur('9.50'),
        available: true,
      },
    ],
  },
};

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
});

/** roles undefined = Guest. catalogue(path, url) answers /catalogue*. */
function mockBackend({ roles, catalogue } = {}) {
  backend = { catalogueRequests: [] };
  globalThis.fetch = jest.fn(async (url, init) => {
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace('/api/v1', '');
    if (path === '/health') return response(200, { status: 'ok' });
    if (path === '/auth/resume')
      return roles
        ? response(200, { accessToken: 'access-token' })
        : error(401, 'No token provided');
    if (path === '/auth/me') return response(200, { ...user, roles });
    if (path.startsWith('/catalogue')) {
      backend.catalogueRequests.push({
        path,
        searchParams,
        headers: init.headers,
      });
      return catalogue
        ? catalogue(path, searchParams)
        : response(200, [water, margherita]);
    }
    throw new Error(`Unexpected request to ${path}`);
  });
}

async function settle() {
  for (let i = 0; i < 5; i += 1) await act(async () => {});
}

async function open(path) {
  window.history.replaceState(null, '', path);
  await act(async () =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
  await settle();
}

const main = () => container.querySelector('main').textContent;
const h1 = () => container.querySelector('main h1').textContent;
const sidebarLink = (href) =>
  container.querySelector(`.app-sidebar a[href="${href}"]`);

async function click(element) {
  await act(async () => element.click());
  await settle();
}

describe('WEB03 public sections (catalogue and privacy notice)', () => {
  test('FT18: a Guest opens /catalogue and sees products, prices and allergens without signing in', async () => {
    mockBackend();
    await open('/catalogue');

    expect(window.location.pathname).toBe('/catalogue');
    expect(h1()).toBe('Catalogue');
    expect(main()).toContain('Water');
    expect(main()).toContain('€1.50');
    expect(main()).toContain('No declared allergens.');
    expect(main()).toContain('Margherita');
    // Only the available size counts for the "from" price.
    expect(main()).toContain('From €9.50');
    expect(main()).toContain('Gluten');
    expect(sidebarLink('/catalogue').getAttribute('aria-current')).toBe('page');
    // Public read: never an access token.
    expect(backend.catalogueRequests.length).toBeGreaterThan(0);
    for (const { headers } of backend.catalogueRequests)
      expect(headers.Authorization).toBeUndefined();
  });

  test('FT20: a Guest opens a product from the catalogue and sees sizes, ingredients and allergens', async () => {
    mockBackend({
      catalogue: (path) =>
        path === '/catalogue/PROD-00010'
          ? response(200, margherita)
          : response(200, [water, margherita]),
    });
    await open('/catalogue');

    await click(
      [...container.querySelectorAll('main a')].find(
        (link) => link.textContent === 'Margherita',
      ),
    );

    expect(window.location.pathname).toBe('/catalogue/PROD-00010');
    expect(h1()).toBe('Margherita');
    const rows = [...container.querySelectorAll('main tbody tr')].map(
      (row) => row.textContent,
    );
    expect(rows).toEqual(['Large€12.00Unavailable', 'Medium€9.50Available']);
    expect(main()).toContain('Mozzarella');
    expect(main()).toContain('Gluten');
    expect(main()).toContain('Milk');
    expect(sidebarLink('/catalogue').getAttribute('aria-current')).toBe(
      'location',
    );
  });

  test('FT21: an unknown or malformed product is explained; a malformed id is never requested', async () => {
    mockBackend({
      catalogue: () => error(404, 'Product not found in the catalogue'),
    });
    await open('/catalogue/PROD-99999');
    expect(main()).toContain('This product does not exist or is not on sale.');
    expect(backend.catalogueRequests.map(({ path }) => path)).toContain(
      '/catalogue/PROD-99999',
    );

    backend.catalogueRequests.length = 0;
    await open('/catalogue/not-a-product');
    expect(main()).toContain('This product does not exist or is not on sale.');
    expect(backend.catalogueRequests).toEqual([]);
  });

  test('FT22: search uses the API filter; empty results and failures are explained and can be retried', async () => {
    let fail = true;
    mockBackend({
      catalogue: (_path, query) => {
        if (fail) return error(503, 'Service unavailable');
        return response(
          200,
          query.get('componentName') === 'Basil' ? [] : [margherita],
        );
      },
    });
    await open('/catalogue');
    expect(container.querySelector('main [role="alert"]').textContent).toBe(
      'The catalogue could not be loaded.',
    );

    fail = false;
    await click(
      [...container.querySelectorAll('main button')].find(
        (button) => button.textContent === 'Try again',
      ),
    );
    expect(main()).toContain('Margherita');

    const input = container.querySelector('#catalogue-component');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set;
      setValue.call(input, 'Basil');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      container
        .querySelector('form[role="search"]')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        ),
    );
    await settle();

    expect(main()).toContain('No product contains the ingredient "Basil".');
    const last = backend.catalogueRequests.at(-1);
    expect(last.searchParams.get('componentName')).toBe('Basil');
  });

  test('FT23: a Guest reads the privacy notice; no business request is sent', async () => {
    mockBackend();
    await open('/privacy');

    expect(h1()).toBe('Privacy notice');
    expect(main()).toContain('Data controller');
    expect(main()).toContain('Your rights');
    expect(sidebarLink('/privacy').getAttribute('aria-current')).toBe('page');
    expect(backend.catalogueRequests).toEqual([]);
  });

  test.each([['CUSTOMER'], ['EMPLOYEE'], ['MANAGER'], ['ADMINISTRATOR']])(
    'FT24: %s keeps the public sections in the menu and reads the catalogue without sending its token',
    async (role) => {
      mockBackend({ roles: [role] });
      await open('/catalogue');

      expect(h1()).toBe('Catalogue');
      expect(main()).toContain('Margherita');
      expect(sidebarLink('/catalogue')).not.toBeNull();
      expect(sidebarLink('/privacy')).not.toBeNull();
      for (const { headers } of backend.catalogueRequests)
        expect(headers.Authorization).toBeUndefined();
    },
  );
});
