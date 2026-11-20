/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { jest } from '@jest/globals';
import LocaleProvider from '../../src/shared/locale/LocaleProvider.jsx';
import { AuthContext } from '../../src/features/authentication/state/authContext.js';
import AllergensPage from '../../src/features/business-management/allergens/AllergensPage.jsx';
import ProductsPage from '../../src/features/business-management/products/ProductsPage.jsx';

let container;
let root;
let api;

function managerSession() {
  return {
    status: 'authenticated',
    hasAnyRole: (...roles) => roles.includes('MANAGER'),
  };
}

async function render(page) {
  await act(async () => {
    root.render(
      <LocaleProvider>
        <AuthContext.Provider value={managerSession()}>
          <MemoryRouter>{page}</MemoryRouter>
        </AuthContext.Provider>
      </LocaleProvider>,
    );
  });
}

function click(label) {
  const button = [...container.querySelectorAll('button')].find(
    (item) => item.textContent.trim() === label,
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return act(async () => button.click());
}

function setValue(id, value) {
  const input = container.querySelector(`#${id}`);
  if (!input) throw new Error(`Input not found: ${id}`);
  const prototype =
    input.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : input.tagName === 'SELECT'
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
  return act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  api = {
    list: jest.fn().mockResolvedValue([]),
    listCategories: jest
      .fn()
      .mockResolvedValue([{ id: 'CAT-00001', name: 'Ingredientes' }]),
    listAllergens: jest.fn().mockResolvedValue([{ id: 7, name: 'Leite' }]),
    listComponentTypes: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
  };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

test('allergen form rejects identifiers outside the EU allergen range before calling the API', async () => {
  await render(<AllergensPage api={api} />);
  await click('Criar');
  await setValue('id', '15');
  await setValue('name', 'Alergénio inválido');
  await click('Guardar');

  expect(api.create).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Verifique o valor neste campo.');
});

test('product form requires description and category and does not submit incomplete data', async () => {
  await render(<ProductsPage api={api} />);
  await click('Criar');
  await setValue('name', 'Pizza de teste');
  await click('Guardar');

  expect(api.create).not.toHaveBeenCalled();
  expect(
    container.querySelector('#description').getAttribute('aria-invalid'),
  ).toBe('true');
  expect(
    container.querySelector('#categoryId').getAttribute('aria-invalid'),
  ).toBe('true');
});