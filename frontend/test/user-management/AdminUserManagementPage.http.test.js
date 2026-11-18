/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { jest } from '@jest/globals';
import AdminUserManagementPage from '../../src/features/user-management/AdminUserManagementPage.jsx';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('clears loaded accounts after a real HTTP 403 response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const refreshSession = jest.fn().mockResolvedValue({
    status: 'authenticated',
    user: { roles: ['CUSTOMER'] },
  });
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce(
      response(200, [
        {
          id: 'USR-00001',
          name: 'Ana',
          email: 'ana@example.com',
          roles: ['CUSTOMER'],
          active: true,
          everActivated: true,
        },
      ]),
    )
    .mockResolvedValueOnce(
      response(403, { error: { message: 'Administrator access required' } }),
    );

  try {
    await act(async () =>
      root.render(
        <AdminUserManagementPage
          token="session-token"
          refreshSession={refreshSession}
        />,
      ),
    );
    expect(container.querySelector('#managed-user')).not.toBeNull();

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent.trim() === 'Desativar conta')
        .click();
    });
    await act(async () => {
      [...container.querySelectorAll('[role="alertdialog"] button')]
        .find((button) => button.textContent.trim() === 'Confirmar')
        .click();
    });

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8080/api/v1/users/USR-00001',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(container.querySelector('#managed-user')).toBeNull();
    expect(container.querySelector('[role=alert]').textContent).toContain(
      'Não tem permissão',
    );
    // WEB03 (BR 13): the 403 is handled by the global apiClient handler
    // registered by AuthProvider (not mounted here), never by the page.
    expect(refreshSession).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
