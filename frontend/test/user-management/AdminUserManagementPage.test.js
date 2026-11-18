/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { jest } from '@jest/globals';

jest.mock('../../src/features/user-management/adminUserApi.js', () => ({
  adminUserApi: {
    list: jest.fn(),
    get: jest.fn(),
    updateRoles: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
    invite: jest.fn(),
  },
}));

import { adminUserApi } from '../../src/features/user-management/adminUserApi.js';
import AdminUserManagementPage from '../../src/features/user-management/AdminUserManagementPage.jsx';

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

async function renderPage({ user, refreshSession }) {
  adminUserApi.list.mockResolvedValue([user]);
  await act(async () =>
    root.render(
      <AdminUserManagementPage
        token="session-token"
        refreshSession={refreshSession}
      />,
    ),
  );
}

async function clickButton(label, scope = container) {
  await act(async () => {
    [...scope.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === label)
      ?.click();
  });
}

async function confirmDialog() {
  await act(async () => {
    container.querySelector('[role="alertdialog"] .button--danger')?.click();
  });
}

test.each([
  [false, 'Enviar ou substituir convite'],
  [true, 'Reativar conta'],
])(
  'shows only the matching action for an inactive account (everActivated=%s)',
  async (everActivated, expectedAction) => {
    const refreshSession = jest.fn().mockResolvedValue({
      status: 'authenticated',
      user: { roles: ['ADMINISTRATOR'] },
    });
    await renderPage({
      user: {
        id: 'USR-00001',
        name: 'Ana',
        email: 'ana@example.com',
        roles: ['CUSTOMER'],
        active: false,
        everActivated,
      },
      refreshSession,
    });

    const buttons = [...container.querySelectorAll('button')].map((button) =>
      button.textContent.trim(),
    );
    expect(buttons).toContain(expectedAction);
    expect(buttons).not.toContain(
      everActivated ? 'Enviar ou substituir convite' : 'Reativar conta',
    );
  },
);

test('clears the account list when a role update removes Administrator access', async () => {
  const refreshSession = jest.fn().mockResolvedValue({
    status: 'authenticated',
    user: { roles: ['CUSTOMER'] },
  });
  adminUserApi.updateRoles.mockResolvedValue({});
  await renderPage({
    user: {
      id: 'USR-00001',
      name: 'Ana',
      email: 'ana@example.com',
      roles: ['ADMINISTRATOR', 'CUSTOMER'],
      active: true,
      everActivated: true,
    },
    refreshSession,
  });

  const administrator = [
    ...container.querySelectorAll('input[type="checkbox"]'),
  ].find((input) => input.parentElement.textContent.trim() === 'Administrador');
  await act(async () => {
    administrator.click();
  });
  await act(async () => {
    [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Guardar perfis')
      .click();
  });
  await act(async () => {
    [...container.querySelectorAll('[role="alertdialog"] button')]
      .find((button) => button.textContent.trim() === 'Confirmar')
      .click();
  });

  expect(adminUserApi.updateRoles).toHaveBeenCalledWith(
    'session-token',
    'USR-00001',
    ['CUSTOMER'],
  );
  expect(refreshSession).toHaveBeenCalledTimes(1);
  expect(container.querySelector('#managed-user')).toBeNull();
  expect(container.textContent).toContain('Não foram encontradas contas.');
  expect(adminUserApi.list).toHaveBeenCalledTimes(1);
});

test('clears already loaded accounts when the API later denies access', async () => {
  const refreshSession = jest.fn().mockResolvedValue({
    status: 'authenticated',
    user: { roles: ['ADMINISTRATOR'] },
  });
  adminUserApi.list
    .mockResolvedValueOnce([
      {
        id: 'USR-00001',
        name: 'Ana',
        email: 'ana@example.com',
        roles: ['CUSTOMER'],
        active: true,
        everActivated: true,
      },
    ])
    .mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );
  adminUserApi.deactivate.mockResolvedValue({});
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

  expect(container.querySelector('#managed-user')).toBeNull();
  expect(container.querySelector('[role=alert]').textContent).toContain(
    'Não tem permissão',
  );
  // WEB03 (BR 13): only the successful change re-reads the roles here; the
  // 403 is handled by the global apiClient handler, not by the page.
  expect(refreshSession).toHaveBeenCalledTimes(1);
});

test('canceling a consequential action makes no API request', async () => {
  const refreshSession = jest.fn();
  await renderPage({
    user: {
      id: 'USR-00001',
      name: 'Ana',
      email: 'ana@example.com',
      roles: ['CUSTOMER'],
      active: true,
      everActivated: true,
    },
    refreshSession,
  });

  await clickButton('Desativar conta');
  expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
  await clickButton(
    'Cancelar',
    container.querySelector('[role="alertdialog"]'),
  );

  expect(adminUserApi.deactivate).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();
});

test('confirms account reactivation before restoring protected access', async () => {
  const refreshSession = jest.fn().mockResolvedValue({
    status: 'authenticated',
    user: { roles: ['ADMINISTRATOR'] },
  });
  adminUserApi.reactivate.mockResolvedValue({});
  await renderPage({
    user: {
      id: 'USR-00001',
      name: 'Ana',
      email: 'ana@example.com',
      roles: ['CUSTOMER'],
      active: false,
      everActivated: true,
    },
    refreshSession,
  });

  await clickButton('Reativar conta');
  expect(adminUserApi.reactivate).not.toHaveBeenCalled();
  expect(container.textContent).toContain('A conta será reativada');
  await confirmDialog();

  expect(adminUserApi.reactivate).toHaveBeenCalledTimes(1);
});

test('allows an explicit retry only after a retryable invitation failure', async () => {
  const refreshSession = jest.fn();
  adminUserApi.invite
    .mockResolvedValueOnce({ deliveryStatus: 'FAILED', retryable: true })
    .mockResolvedValueOnce({ deliveryStatus: 'SENT' });
  await renderPage({
    user: {
      id: 'USR-00001',
      name: 'Ana',
      email: 'ana@example.com',
      roles: ['CUSTOMER'],
      active: false,
      everActivated: false,
      activationMethod: 'LOCAL',
    },
    refreshSession: refreshSession.mockResolvedValue({
      status: 'authenticated',
      user: { roles: ['ADMINISTRATOR'] },
    }),
  });

  await clickButton('Enviar ou substituir convite');
  await confirmDialog();
  expect(container.textContent).toContain('Pode repetir o envio');
  await clickButton('Repetir envio do convite');
  expect(container.textContent).toContain(
    'convite anterior pode deixar de funcionar',
  );
  await confirmDialog();

  expect(adminUserApi.invite).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Convite enviado.');
  expect(refreshSession).toHaveBeenCalledTimes(1);
});

test('preserves the selected activation method when the replacement email fails', async () => {
  const refreshSession = jest.fn().mockResolvedValue({
    status: 'authenticated',
    user: { roles: ['ADMINISTRATOR'] },
  });
  adminUserApi.invite
    .mockResolvedValueOnce({
      deliveryStatus: 'FAILED',
      retryable: true,
      activationMethod: 'EXTERNAL',
    })
    .mockResolvedValueOnce({
      deliveryStatus: 'SENT',
      activationMethod: 'EXTERNAL',
    });
  await renderPage({
    user: {
      id: 'USR-00001',
      name: 'Ana',
      email: 'ana@example.com',
      roles: ['CUSTOMER'],
      active: false,
      everActivated: false,
      activationMethod: null,
    },
    refreshSession,
  });
  await clickButton('Enviar ou substituir convite');
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  const select = container.querySelector('#replacement-activation-method');
  await act(async () => {
    select.value = 'EXTERNAL';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await clickButton('Enviar ou substituir convite');
  await confirmDialog();
  expect(adminUserApi.invite).toHaveBeenNthCalledWith(
    1,
    'session-token',
    'USR-00001',
    'EXTERNAL',
  );
  expect(container.querySelector('#replacement-activation-method')).toBeNull();
  await clickButton('Repetir envio do convite');
  await confirmDialog();
  expect(adminUserApi.invite).toHaveBeenNthCalledWith(
    2,
    'session-token',
    'USR-00001',
    undefined,
  );
});

test('does not offer an unsafe retry after an unknown invitation outcome', async () => {
  const refreshSession = jest.fn();
  adminUserApi.invite.mockRejectedValue(
    Object.assign(new Error('network detail'), { kind: 'network' }),
  );
  await renderPage({
    user: {
      id: 'USR-00001',
      name: 'Ana',
      email: 'ana@example.com',
      roles: ['CUSTOMER'],
      active: false,
      everActivated: false,
      activationMethod: 'LOCAL',
    },
    refreshSession,
  });

  await clickButton('Enviar ou substituir convite');
  await confirmDialog();
  expect(container.textContent).toContain(
    'Não foi possível confirmar o resultado',
  );
  expect(container.textContent).not.toContain('network detail');
  await clickButton('Repetir envio do convite');
  expect(container.textContent).toContain(
    'O convite anterior pode deixar de funcionar',
  );
  await clickButton(
    'Cancelar',
    container.querySelector('[role="alertdialog"]'),
  );

  expect(adminUserApi.invite).toHaveBeenCalledTimes(1);
  expect(refreshSession).not.toHaveBeenCalled();
});

test('does not automatically retry a pending role update', async () => {
  const refreshSession = jest.fn().mockResolvedValue({
    status: 'authenticated',
    user: { roles: ['ADMINISTRATOR'] },
  });
  let resolveUpdate;
  adminUserApi.updateRoles.mockReturnValue(
    new Promise((resolve) => {
      resolveUpdate = resolve;
    }),
  );
  await renderPage({
    user: {
      id: 'USR-00001',
      name: 'Ana',
      email: 'ana@example.com',
      roles: ['CUSTOMER'],
      active: true,
      everActivated: true,
    },
    refreshSession,
  });

  const manager = [
    ...container.querySelectorAll('input[type="checkbox"]'),
  ].find(
    (input) => input.parentElement.textContent.trim() === 'Gestor da LaPrizza',
  );
  await act(async () => manager.click());
  await clickButton('Guardar perfis');
  await confirmDialog();
  expect(adminUserApi.updateRoles).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('A processar…');
  expect(
    [...container.querySelectorAll('button')].some((button) => button.disabled),
  ).toBe(true);

  await act(async () => resolveUpdate({}));
  expect(adminUserApi.updateRoles).toHaveBeenCalledTimes(1);
});

test('preserves the role draft and blocks changes until current data is reviewed after an unknown update', async () => {
  const refreshSession = jest.fn().mockResolvedValue({
    status: 'authenticated',
    user: { roles: ['ADMINISTRATOR'] },
  });
  adminUserApi.updateRoles.mockRejectedValue(
    Object.assign(new Error('unreadable response detail'), {
      kind: 'invalid-response',
      status: 200,
    }),
  );
  adminUserApi.get.mockResolvedValue({
    id: 'USR-00001',
    roles: ['CUSTOMER', 'EMPLOYEE'],
    active: true,
  });
  const user = {
    id: 'USR-00001',
    name: 'Ana',
    email: 'ana@example.com',
    roles: ['CUSTOMER'],
    active: true,
    everActivated: true,
  };
  await renderPage({ user, refreshSession });

  const manager = [
    ...container.querySelectorAll('input[type="checkbox"]'),
  ].find(
    (input) => input.parentElement.textContent.trim() === 'Gestor da LaPrizza',
  );
  await act(async () => manager.click());
  await clickButton('Guardar perfis');
  await confirmDialog();

  expect(adminUserApi.updateRoles).toHaveBeenCalledTimes(1);
  expect(adminUserApi.get).toHaveBeenCalledWith('session-token', 'USR-00001');
  expect(adminUserApi.list).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain(
    'O resultado difere dos dados submetidos.',
  );
  expect(container.textContent).not.toContain('unreadable response detail');

  const employee = [
    ...container.querySelectorAll('input[type="checkbox"]'),
  ].find(
    (input) =>
      input.parentElement.textContent.trim() === 'Funcionário do restaurante',
  );
  expect(manager.checked).toBe(true);
  expect(employee.checked).toBe(false);
  expect(manager.closest('fieldset').disabled).toBe(true);
  expect(container.querySelector('#managed-user').disabled).toBe(true);
  expect(
    [...container.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Guardar perfis',
    ).disabled,
  ).toBe(true);

  await clickButton('Rever dados atuais');

  expect(manager.checked).toBe(false);
  expect(employee.checked).toBe(true);
  expect(manager.closest('fieldset').disabled).toBe(false);
  expect(container.textContent).toContain('Dados atuais revistos.');
  expect(adminUserApi.updateRoles).toHaveBeenCalledTimes(1);
  expect(adminUserApi.list).toHaveBeenCalledTimes(1);
});

test('updates the displayed account and actions when read-back confirms deactivation', async () => {
  const refreshSession = jest.fn().mockResolvedValue({
    status: 'authenticated',
    user: { roles: ['ADMINISTRATOR'] },
  });
  adminUserApi.deactivate.mockRejectedValue(
    Object.assign(new Error('response lost'), { kind: 'timeout' }),
  );
  adminUserApi.get.mockResolvedValue({
    id: 'USR-00001',
    roles: ['CUSTOMER'],
    active: false,
  });
  await renderPage({
    user: {
      id: 'USR-00001',
      name: 'Ana',
      email: 'ana@example.com',
      roles: ['CUSTOMER'],
      active: true,
      everActivated: true,
    },
    refreshSession,
  });

  await clickButton('Desativar conta');
  await confirmDialog();

  expect(adminUserApi.deactivate).toHaveBeenCalledTimes(1);
  expect(adminUserApi.get).toHaveBeenCalledWith('session-token', 'USR-00001');
  expect(adminUserApi.list).toHaveBeenCalledTimes(1);
  expect(
    container.querySelector('#managed-user').selectedOptions[0].textContent,
  ).toContain('Inativa');
  expect(
    [...container.querySelectorAll('button')].map((button) =>
      button.textContent.trim(),
    ),
  ).toContain('Reativar conta');
  expect(container.textContent).not.toContain('Desativar conta');
  expect(container.textContent).toContain('Utilizador atualizado.');
});
