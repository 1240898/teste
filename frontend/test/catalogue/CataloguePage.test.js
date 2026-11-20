/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { jest } from '@jest/globals';

jest.mock('../../src/features/catalogue/catalogueApi.js', () => ({
  catalogueApi: {
    list: jest.fn(),
    get: jest.fn(),
  },
}));

import { catalogueApi } from '../../src/features/catalogue/catalogueApi.js';
import CataloguePage from '../../src/features/catalogue/CataloguePage.jsx';

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function renderPage() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <CataloguePage />
      </MemoryRouter>,
    );
  });
}

test('settles a failed catalogue read and retries it only after an explicit action', async () => {
  catalogueApi.list
    .mockRejectedValueOnce(
      Object.assign(new Error('internal network detail'), { kind: 'network' }),
    )
    .mockResolvedValueOnce([]);
  await renderPage();

  expect(catalogueApi.list).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain(
    'Não foi possível contactar o servidor',
  );
  expect(container.textContent).not.toContain('internal network detail');
  expect(container.textContent).not.toContain('A carregar o catálogo');

  await act(async () => {
    [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Tentar novamente')
      .click();
  });

  expect(catalogueApi.list).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Ainda não há produtos à venda');
});

test('keeps a successful empty catalogue distinct from a failed read', async () => {
  catalogueApi.list.mockResolvedValue([]);
  await renderPage();

  expect(container.textContent).toContain('Ainda não há produtos à venda');
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(
    [...container.querySelectorAll('button')].some((button) =>
      button.textContent.includes('Tentar novamente'),
    ),
  ).toBe(false);
});

test('renders API product data, price and allergen labels on the public catalogue', async () => {
  catalogueApi.list.mockResolvedValue([
    {
      id: 'PROD-00001',
      name: 'Pizza de teste',
      description: 'Descrição pública',
      category: { name: 'Pizzas' },
      available: true,
      price: { amount: '8.50', currency: 'EUR' },
      allergens: [{ id: 7, name: 'Leite' }],
    },
  ]);
  await renderPage();

  expect(container.textContent).toContain('Pizza de teste');
  expect(container.textContent).toContain('Descrição pública');
  expect(container.textContent).toContain('8,50');
  expect(container.textContent).toContain('Leite');
});

test('allergen names come from the client locale, not from the API name', async () => {
  catalogueApi.list.mockResolvedValue([
    {
      id: 'PROD-00001',
      name: 'Pizza de teste',
      description: '',
      category: { name: 'Pizzas' },
      available: true,
      price: { amount: '8.50', currency: 'EUR' },
      allergens: [{ id: 7, name: 'Milk' }],
    },
  ]);
  await renderPage();

  const allergenTags = container.querySelector('.catalogue-allergens');
  expect(allergenTags.textContent).toContain('Leite');
  expect(allergenTags.textContent).not.toContain('Milk');
});

test('components sold on their own are offered in the component filters', async () => {
  catalogueApi.list.mockResolvedValue([
    {
      id: 'PROD-00010',
      name: 'Margherita',
      description: '',
      category: { name: 'Pizzas' },
      available: true,
      price: null,
      allergens: [],
      isPizzaComponent: false,
      pizza: {
        defaultComponents: [{ id: 'PROD-00001', name: 'Mozzarella' }],
        sizes: [],
      },
    },
    {
      id: 'PROD-00020',
      name: 'Azeitonas extra',
      description: '',
      category: { name: 'Extras' },
      available: true,
      price: { amount: '1.00', currency: 'EUR' },
      allergens: [],
      isPizzaComponent: true,
      pizza: null,
    },
  ]);
  await renderPage();

  for (const selector of ['#catalogue-components', '#catalogue-exclude-components']) {
    const values = [...container.querySelectorAll(`${selector} option`)].map(
      (option) => option.value,
    );
    // From a pizza recipe and sold separately (in no recipe).
    expect(values).toEqual(expect.arrayContaining(['PROD-00001', 'PROD-00020']));
    // A pizza is not a component.
    expect(values).not.toContain('PROD-00010');
  }
});
