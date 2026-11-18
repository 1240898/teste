/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../src/features/authentication/state/authContext.js';
import { hasAnyRole } from '../../src/features/authentication/state/authSession.js';
import RequireRole from '../../src/app/navigation/RequireRole.jsx';

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

function renderWith(session) {
  const value = { ...session, hasAnyRole: (...r) => hasAnyRole(session, r) };
  act(() =>
    root.render(
      <AuthContext.Provider value={value}>
        <RequireRole roles={['MANAGER']}>
          <button type="button">Edit product</button>
        </RequireRole>
      </AuthContext.Provider>,
    ),
  );
}

describe('WEB03 FT08: RequireRole (action-level visibility)', () => {
  test.each([
    [{ status: 'authenticated', user: { roles: ['EMPLOYEE'] } }, false],
    [{ status: 'authenticated', user: { roles: ['MANAGER'] } }, true],
    [
      { status: 'authenticated', user: { roles: ['CUSTOMER', 'MANAGER'] } },
      true,
    ],
    [{ status: 'loading', user: null }, false],
    [{ status: 'denied', user: { roles: ['MANAGER'] } }, false],
    [{ status: 'guest', user: null }, false],
  ])('%j shows the action: %s', (session, visible) => {
    renderWith(session);
    expect(container.querySelector('button') !== null).toBe(visible);
  });
});