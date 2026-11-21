/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/app/App.jsx';
import { LOCALE_STORAGE_KEY } from '../../src/shared/locale/localeStorage.js';

// GDP01: "My data" (/account/privacy) — profile completion, own allergens with
// explicit consent (GDPR Art. 9(2)(a)) and marketing consent (Art. 7(3)).
const originalFetch = globalThis.fetch;
const response = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});
const ALLERGENS = [
  { id: 1, name: 'Gluten' },
  { id: 7, name: 'Milk' },
  { id: 8, name: 'Nuts' },
];
const profile = (overrides = {}) => ({
  id: 'CUST-0001',
  name: 'Ana',
  email: 'ana@example.com',
  phoneNumber: '+351912345678',
  dietaryRestrictions: [],
  userId: 'USR-00001',
  active: true,
  healthDataConsent: { given: false, timestamp: null },
  ...overrides,
});

let container;
let root;
let backend;

function mockBackend({ customer = profile(), marketingConsent = false } = {}) {
  backend = { customer, marketingConsent };
  globalThis.fetch = jest.fn(async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/api/v1', '');
    const body = options.body ? JSON.parse(options.body) : undefined;
    if (path === '/health') return response(200, { status: 'ok' });
    if (path === '/auth/resume')
      return response(200, { accessToken: 'access-token' });
    if (path === '/auth/me')
      return response(200, {
        id: 'USR-00001',
        name: 'Ana',
        email: 'ana@example.com',
        active: true,
        roles: ['CUSTOMER'],
        marketingConsent: backend.marketingConsent,
      });
    if (path === '/allergens') return response(200, ALLERGENS);
    if (path === '/customers/me' && options.method === 'GET')
      return backend.customer
        ? response(200, backend.customer)
        : response(404, {
            error: { message: 'Customer profile not completed' },
          });
    if (path === '/customers/me' && options.method === 'POST') {
      backend.customer = profile({ phoneNumber: body.phoneNumber });
      return response(201, backend.customer);
    }
    if (path === '/customers/me/allergens') {
      backend.customer = profile({
        healthDataConsent: {
          given: body.healthDataConsent,
          timestamp: '2026-11-15T10:00:00.000Z',
        },
        dietaryRestrictions: body.allergenIds.map((id) => ({
          name: ALLERGENS.find((a) => a.id === id).name,
          description: null,
          allergenId: id,
        })),
      });
      return response(200, backend.customer);
    }
    if (path === '/auth/me/marketing-consent') {
      backend.marketingConsent = body.marketingConsent;
      return response(200, { marketingConsent: body.marketingConsent });
    }
    throw new Error(`Unexpected request to ${path}`);
  });
}

const requests = (path, method) =>
  globalThis.fetch.mock.calls.filter(
    ([url, options]) =>
      new URL(url).pathname === `/api/v1${path}` &&
      (!method || options?.method === method),
  );
const main = () => container.querySelector('main');
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const submit = async (form) => {
  await act(async () => form.querySelector('[type="submit"]').click());
  await settle();
};

async function open() {
  window.history.replaceState(null, '', '/account/privacy');
  await act(async () => root.render(<App />));
  await settle();
}

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
  localStorage.clear();
  sessionStorage.clear();
  globalThis.fetch = originalFetch;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  window.history.replaceState(null, '', '/');
});

it('asks for the phone number before showing the customer features', async () => {
  mockBackend({ customer: null });
  await open();

  expect(main().textContent).toContain('Complete your profile');
  const form = main().querySelector('form');
  form.elements.phoneNumber.value = '912345678';
  await submit(form);
  expect(main().textContent).toContain('Invalid phone number');
  expect(requests('/customers/me', 'POST')).toHaveLength(0);

  form.elements.phoneNumber.value = '+351 933 333 333';
  await submit(form);
  expect(JSON.parse(requests('/customers/me', 'POST')[0][1].body)).toEqual({
    phoneNumber: '+351 933 333 333',
  });
  expect(main().textContent).toContain('My allergens');
  expect(main().textContent).toContain('ana@example.com');
});

it('allergens can only be chosen with explicit consent', async () => {
  mockBackend();
  await open();

  const fieldset = main().querySelector('fieldset.allergen-options');
  expect(fieldset.disabled).toBe(true);
  const form = fieldset.closest('form');
  await act(async () => form.elements.healthDataConsent.click());
  expect(fieldset.disabled).toBe(false);
  const options = [...form.querySelectorAll('input[name="allergenIds"]')];
  await act(async () => options[1].click());
  await act(async () => options[0].click());
  await submit(form);

  expect(JSON.parse(requests('/customers/me/allergens')[0][1].body)).toEqual({
    healthDataConsent: true,
    allergenIds: [1, 7],
  });
  expect(main().textContent).toContain('Allergens saved.');
});

it('withdrawing consent is confirmed and erases the allergens', async () => {
  mockBackend({
    customer: profile({
      healthDataConsent: {
        given: true,
        timestamp: '2026-11-15T10:00:00.000Z',
      },
      dietaryRestrictions: [{ name: 'Milk', description: null, allergenId: 7 }],
    }),
  });
  await open();

  const form = main()
    .querySelector('fieldset.allergen-options')
    .closest('form');
  expect(form.querySelector('input[value="7"]').checked).toBe(true);
  await act(async () => form.elements.healthDataConsent.click());
  await submit(form);
  expect(requests('/customers/me/allergens')).toHaveLength(0);
  expect(container.querySelector('[role="alertdialog"]').textContent).toContain(
    'Withdrawing consent erases the stored allergens.',
  );

  await act(async () =>
    container
      .querySelector('[role="alertdialog"] .form-actions button:last-child')
      .click(),
  );
  await settle();
  expect(JSON.parse(requests('/customers/me/allergens')[0][1].body)).toEqual({
    healthDataConsent: false,
    allergenIds: [],
  });
  expect(main().textContent).toContain('Consent withdrawn.');
});

it('the customer gives marketing consent after registration', async () => {
  mockBackend();
  await open();

  const form = main()
    .querySelector('input[name="marketingConsent"]')
    .closest('form');
  await act(async () => form.elements.marketingConsent.click());
  await submit(form);

  expect(
    JSON.parse(requests('/auth/me/marketing-consent', 'PUT')[0][1].body),
  ).toEqual({ marketingConsent: true });
  expect(main().textContent).toContain(
    'You will now receive marketing emails.',
  );
  expect(form.elements.marketingConsent.checked).toBe(true);
});

it('shows the stored marketing consent and lets the customer withdraw it', async () => {
  mockBackend({ marketingConsent: true });
  await open();

  const form = main()
    .querySelector('input[name="marketingConsent"]')
    .closest('form');
  expect(form.elements.marketingConsent.checked).toBe(true);
  await act(async () => form.elements.marketingConsent.click());
  await submit(form);

  expect(
    JSON.parse(requests('/auth/me/marketing-consent', 'PUT')[0][1].body),
  ).toEqual({ marketingConsent: false });
  expect(main().textContent).toContain(
    'You will no longer receive marketing emails.',
  );
  expect(form.elements.marketingConsent.checked).toBe(false);
});