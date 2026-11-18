/* eslint-disable react-refresh/only-export-components */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import LocaleProvider from '../../src/shared/locale/LocaleProvider.jsx';
import { useLocale } from '../../src/shared/locale/localeContext.js';
import { LOCALE_STORAGE_KEY } from '../../src/shared/locale/localeStorage.js';

export const layout = (overrides = {}) => ({
  schemaVersion: 1,
  units: 'meters',
  kitchen: { dimensions: { width: 12, depth: 8, height: 3.2 } },
  assemblyLine: { wall: 'NORTH' },
  elements: [
    { id: 'line-arm-2', placement: { position: { x: 0, y: 0.9, z: -3.7 } } },
    { id: 'fridge-2', placement: { position: { x: -5.2, y: 0, z: 2.8 } } },
    { id: 'table-1', placement: { position: { x: 0, y: 0, z: 2.5 } } },
  ],
  ...overrides,
});

export const detail = (overrides = {}) => ({
  id: 'KCF-00002',
  name: 'Compact kitchen',
  status: 'INACTIVE',
  version: 3,
  content: layout(),
  createdAt: '2026-11-12T10:15:00.000Z',
  updatedAt: '2026-11-12T10:15:00.000Z',
  activatedAt: null,
  ...overrides,
});

export const httpError = (status, message, details) =>
  Object.assign(new Error(message), {
    name: 'ApiError',
    status,
    kind: 'http',
    ...(details ? { details } : {}),
  });

let switchLocale;
function LocaleHandle() {
  switchLocale = useLocale().changeLocale;
  return null;
}

/** Mounts `element` under LocaleProvider (EN by default) and a router. */
export function mount() {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en-GB');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  return {
    container,
    async render(element, { path = '/', at = '/', routes = {} } = {}) {
      await act(async () =>
        root.render(
          <LocaleProvider>
            <LocaleHandle />
            <MemoryRouter initialEntries={[at]}>
              <Routes>
                <Route path={path} element={element} />
                {Object.entries(routes).map(([routePath, routeElement]) => (
                  <Route
                    key={routePath}
                    path={routePath}
                    element={routeElement}
                  />
                ))}
                <Route path="*" element={<p>other page</p>} />
              </Routes>
            </MemoryRouter>
          </LocaleProvider>,
        ),
      );
    },
    unmount() {
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      act(() => root.unmount());
      container.remove();
      localStorage.clear();
    },
  };
}

export async function setLocale(locale) {
  await act(async () => switchLocale(locale));
}

export function button(container, label) {
  return [...container.querySelectorAll('button')].find(
    (item) => item.textContent.trim() === label,
  );
}

export async function click(element) {
  await act(async () => {
    element.click();
  });
}

export async function clickButton(container, label) {
  const target = button(container, label);
  if (!target) throw new Error(`Button not found: ${label}`);
  await click(target);
}

export async function type(element, value) {
  const prototype =
    element.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const { set } = Object.getOwnPropertyDescriptor(prototype, 'value');
  await act(async () => {
    set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export async function check(element) {
  await act(async () => {
    element.click();
  });
}