/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../../src/app/App.jsx';
import { LOCALE_STORAGE_KEY } from '../../../src/shared/locale/localeStorage.js';

const originalFetch = globalThis.fetch;
let container;
let root;

beforeEach(async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en-GB');
  window.history.replaceState(null, '', '/');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = jest.fn(async (url) => ({
    ok: url.endsWith('/health'),
    status: url.endsWith('/health') ? 200 : 401,
    json: async () => ({ status: 'ok' }),
  }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<App />));
});

afterEach(() => {
  localStorage.clear();
  act(() => root.unmount());
  container.remove();
  globalThis.fetch = originalFetch;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  window.history.replaceState(null, '', '/');
});

it('creates an inactive account and shows that activation is required', async () => {
  const openRegistration = container.querySelector('a[href="/register"]');
  act(() => openRegistration.click());
  expect(window.location.pathname).toBe('/register');

  const form = container.querySelector('form');
  form.elements.name.value = 'Ana';
  form.elements.email.value = 'ana@example.com';
  form.elements.phoneNumber.value = '+351 912 345 678';
  form.elements.password.value = 'LocalTest2026!';
  globalThis.fetch.mockResolvedValueOnce({
    ok: true,
    status: 201,
    json: async () => ({ active: false }),
  });

  await act(async () => form.querySelector('button[type="submit"]').click());

  expect(globalThis.fetch).toHaveBeenLastCalledWith(
    'http://localhost:8080/api/v1/users/register',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'LocalTest2026!',
        marketingConsent: false,
        phoneNumber: '+351 912 345 678',
      }),
    }),
  );
  expect(container.querySelector('main [role="status"]').textContent).toContain(
    'Account created. Check your email for the activation invitation.',
  );
  expect(container.querySelector('input[type="password"]')).toBeNull();
});

it('shows when invitation delivery fails and explains the retry path', async () => {
  const openRegistration = container.querySelector('a[href="/register"]');
  act(() => openRegistration.click());
  const form = container.querySelector('form');
  form.elements.name.value = 'Ana';
  form.elements.email.value = 'ana@example.com';
  form.elements.phoneNumber.value = '+351912345678';
  form.elements.password.value = 'LocalTest2026!';
  globalThis.fetch.mockResolvedValueOnce({
    ok: true,
    status: 201,
    json: async () => ({ invitationDelivery: { deliveryStatus: 'FAILED' } }),
  });

  await act(async () => form.querySelector('button[type="submit"]').click());

  expect(container.querySelector('main [role="alert"]').textContent).toContain(
    'activation email could not be delivered',
  );
  expect(container.querySelector('main [role="alert"]').textContent).toContain(
    'Contact an administrator to retry',
  );
});

it('GDP01: requires a phone number in international format before sending', async () => {
  act(() => container.querySelector('a[href="/register"]').click());
  const form = container.querySelector('form');
  form.elements.name.value = 'Ana';
  form.elements.email.value = 'ana@example.com';
  form.elements.password.value = 'LocalTest2026!';
  const calls = globalThis.fetch.mock.calls.length;

  await act(async () => form.querySelector('button[type="submit"]').click());
  expect(
    container.querySelector('#registration-phone-error').textContent,
  ).toContain('Fill in this field.');

  form.elements.phoneNumber.value = '912345678';
  await act(async () => form.querySelector('button[type="submit"]').click());
  expect(
    container.querySelector('#registration-phone-error').textContent,
  ).toContain('Invalid phone number');
  expect(globalThis.fetch.mock.calls).toHaveLength(calls);
});