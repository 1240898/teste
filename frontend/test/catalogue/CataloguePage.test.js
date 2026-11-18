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
