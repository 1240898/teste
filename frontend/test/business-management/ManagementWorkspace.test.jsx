
/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { jest } from '@jest/globals';
import LocaleProvider from '../../src/shared/locale/LocaleProvider.jsx';
import { AuthContext } from '../../src/features/authentication/state/authContext.js';
import ManagementWorkspace from '../../src/shared/feedback/ManagementWorkspace.jsx';

const config = {
  titleKey: 'categories',
  idKey: 'id',
  canCreate: true,
  canEdit: true,
  fields: [{ name: 'name', labelKey: 'name', required: true }],
  filterFields: [{ name: 'name', labelKey: 'name' }],
  columns: [
    { key: 'id', labelKey: 'identifier' },
    { key: 'name', labelKey: 'name' },
  ],
  rowActions: [
    {
      key: 'delete',
      labelKey: 'delete',
      show: () => true,
      confirmKey: 'managementConfirmDelete',
      run: (api, item) => api.remove(item.id),
    },
  ],
};

let root;
let container;
let api;

function session(role = 'MANAGER') {
  return {
    status: 'authenticated',
    hasAnyRole: (...roles) => roles.includes(role),
  };
}

async function renderWorkspace({ role = 'MANAGER', overrides = {} } = {}) {
  await act(async () => {
    root.render(
      <LocaleProvider>
        <AuthContext.Provider value={session(role)}>
          <MemoryRouter>
            <ManagementWorkspace
              config={{ ...config, ...overrides }}
              api={api}
            />
          </MemoryRouter>
        </AuthContext.Provider>
      </LocaleProvider>,
    );
  });
}

function button(label) {
  return [...container.querySelectorAll('button')].find(
    (item) => item.textContent.trim() === label,
  );
}

async function clickButton(label) {
  const target = button(label);
  if (!target) throw new Error(`Button not found: ${label}`);
  await act(async () => target.click());
}

async function chooseConflictValue(label) {
  const radio = [...container.querySelectorAll('input[type="radio"]')].find(
    (input) => input.closest('label')?.textContent.includes(label),
  );
  if (!radio) throw new Error(`Conflict option not found: ${label}`);
  await act(async () => radio.click());
}

async function fillForm(label, value) {
  const input = container.querySelector(
    `.management-form #${label.toLowerCase()}`,
  );
  if (!input) throw new Error(`Field not found: ${label}`);
  const prototype =
    input.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  // Pending outcomes live in sessionStorage (BR25): isolate every test.
  window.sessionStorage.clear();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  api = {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

test('required fields block invalid submission and focus the missing field', async () => {
  await renderWorkspace();
  await clickButton('Criar');
  await clickButton('Guardar');

  expect(api.create).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Preencha este campo.');
  expect(container.querySelector('#name').getAttribute('aria-invalid')).toBe(
    'true',
  );
});

test('creates a record, closes the form and reloads the saved list', async () => {
  api.list
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: 'CAT-00001', name: 'Teste categoria' }]);
  api.create.mockResolvedValue({ id: 'CAT-00001', name: 'Teste categoria' });
  await renderWorkspace();
  await clickButton('Criar');
  await fillForm('name', 'Teste categoria');
  await clickButton('Guardar');

  expect(api.create).toHaveBeenCalledWith({ name: 'Teste categoria' });
  expect(api.list).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Registo criado.');
  expect(container.textContent).toContain('Teste categoria');
  expect(container.querySelector('.management-form')).toBeNull();
});

test('updates a record and reloads the updated value from the API', async () => {
  api.list
    .mockResolvedValueOnce([{ id: 'CAT-00001', name: 'Nome antigo' }])
    .mockResolvedValueOnce([{ id: 'CAT-00001', name: 'Nome novo' }]);
  api.update.mockResolvedValue({ id: 'CAT-00001', name: 'Nome novo' });
  await renderWorkspace();
  await clickButton('Editar');
  await fillForm('name', 'Nome novo');
  await clickButton('Guardar');

  expect(api.update).toHaveBeenCalledWith('CAT-00001', { name: 'Nome novo' });
  expect(api.list).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Nome novo');
  expect(container.textContent).toContain('Alterações guardadas.');
});

test('requires confirmation before removing a record and reloads after confirmation', async () => {
  api.list
    .mockResolvedValueOnce([{ id: 'CAT-00001', name: 'Remover categoria' }])
    .mockResolvedValueOnce([]);
  api.remove.mockResolvedValue(null);
  await renderWorkspace();
  await clickButton('Remover');

  expect(api.remove).not.toHaveBeenCalled();
  expect(container.textContent).toContain(
    'Confirma que pretende remover este registo?',
  );
  await clickButton('Confirmar');

  expect(api.remove).toHaveBeenCalledWith('CAT-00001');
  expect(api.list).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Não foram encontrados registos.');
});

test('keeps form input and shows safe feedback when a save fails', async () => {
  api.create.mockRejectedValue(
    Object.assign(new Error('private database detail'), { kind: 'network' }),
  );
  await renderWorkspace();
  await clickButton('Criar');
  await fillForm('name', 'Rascunho');
  await clickButton('Guardar');

  expect(container.querySelector('#name').value).toBe('Rascunho');
  expect(container.textContent).toContain(
    'Não foi possível confirmar se a operação foi aplicada.',
  );
  expect(container.textContent).not.toContain('private database detail');
});

test('preserves an unknown create outcome and blocks a duplicate submission', async () => {
  api.create.mockRejectedValue(
    Object.assign(new Error('response was lost'), { kind: 'timeout' }),
  );
  await renderWorkspace();
  await clickButton('Criar');
  await fillForm('name', 'Rascunho de criação');
  await clickButton('Guardar');

  expect(container.querySelector('#name').value).toBe('Rascunho de criação');
  expect(container.textContent).toContain('a repetição está bloqueada');
  expect(button('Guardar').disabled).toBe(true);
  expect(api.create).toHaveBeenCalledTimes(1);
});

test('handles a resolved unknown create outcome and blocks a duplicate submission', async () => {
  api.create.mockResolvedValue({ phase: 'outcome_unknown' });
  await renderWorkspace();
  await clickButton('Criar');
  await fillForm('name', 'Rascunho de criação');
  await clickButton('Guardar');

  expect(container.querySelector('#name').value).toBe('Rascunho de criação');
  expect(container.textContent).toContain('a repetição está bloqueada');
  expect(button('Guardar').disabled).toBe(true);
  expect(api.create).toHaveBeenCalledTimes(1);
});

test('preserves an unknown stock adjustment and blocks resubmission', async () => {
  api.list.mockResolvedValue([{ id: 'PROD-00001', name: 'Queijo' }]);
  api.adjust = jest.fn().mockRejectedValue(
    Object.assign(new Error('response was lost'), { kind: 'timeout' }),
  );
  await renderWorkspace({
    overrides: {
      rowActions: [
        {
          key: 'adjust',
          nonRepeatable: true,
          labelKey: 'managementAdjustStock',
          fields: [{ name: 'units', labelKey: 'units', required: true }],
          toPayload: (value) => value,
          run: (managementApi, item, payload) =>
            managementApi.adjust(item.id, payload),
        },
      ],
    },
  });
  await clickButton('Ajustar stock');
  await fillForm('units', '2');
  await clickButton('Guardar');

  expect(container.querySelector('#units').value).toBe('2');
  expect(button('Guardar').disabled).toBe(true);
  expect(api.adjust).toHaveBeenCalledTimes(1);
});

test('handles a resolved unknown stock adjustment and blocks resubmission', async () => {
  api.list.mockResolvedValue([{ id: 'PROD-00001', name: 'Queijo' }]);
  api.adjust = jest.fn().mockResolvedValue({ phase: 'outcome_unknown' });
  await renderWorkspace({
    overrides: {
      rowActions: [
        {
          key: 'adjust',
          nonRepeatable: true,
          labelKey: 'managementAdjustStock',
          fields: [{ name: 'units', labelKey: 'units', required: true }],
          toPayload: (value) => value,
          run: (managementApi, item, payload) =>
            managementApi.adjust(item.id, payload),
        },
      ],
    },
  });
  await clickButton('Ajustar stock');
  await fillForm('units', '2');
  await clickButton('Guardar');

  expect(container.querySelector('#units').value).toBe('2');
  expect(container.textContent).toContain('a repetição está bloqueada');
  expect(button('Guardar').disabled).toBe(true);
  expect(api.adjust).toHaveBeenCalledTimes(1);
});

test('keeps a product draft after a stale edit until the current version is reviewed', async () => {
  const initial = { id: 'PROD-00001', name: 'Original', updatedAt: 'v1' };
  const latest = { id: 'PROD-00001', name: 'Alterado por outra pessoa', updatedAt: 'v2' };
  api.list.mockResolvedValue([initial]);
  api.getById = jest.fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce(latest);
  api.update.mockRejectedValue(
    Object.assign(new Error('stale'), { kind: 'http', status: 412 }),
  );
  const toForm = (item) => ({ name: item.name, expectedUpdatedAt: item.updatedAt });
  await renderWorkspace({
    overrides: {
      versionField: 'expectedUpdatedAt',
      toForm,
      toPayload: (value) => value,
    },
  });
  await clickButton('Editar');
  await fillForm('name', 'Meu rascunho');
  await clickButton('Guardar');

  expect(container.querySelector('#name').value).toBe('Meu rascunho');
  expect(container.textContent).toContain('Alterado por outra pessoa');
  expect(api.update).toHaveBeenCalledTimes(1);

  // Both managers changed the name: an explicit choice is required first.
  expect(button('Revi os dados atuais; continuar a editar').disabled).toBe(true);
  await chooseConflictValue('Manter o meu valor');
  await clickButton('Revi os dados atuais; continuar a editar');
  api.update.mockResolvedValue({ id: initial.id, name: 'Meu rascunho' });
  await clickButton('Guardar');
  expect(api.update).toHaveBeenLastCalledWith('PROD-00001', {
    name: 'Meu rascunho',
    expectedUpdatedAt: 'v2',
  });
});

test('a stale edit can also adopt the current value of a conflicting field', async () => {
  const initial = { id: 'PROD-00001', name: 'Original', updatedAt: 'v1' };
  const latest = { id: 'PROD-00001', name: 'Alterado por outra pessoa', updatedAt: 'v2' };
  api.list.mockResolvedValue([initial]);
  api.getById = jest.fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce(latest);
  api.update.mockRejectedValueOnce(
    Object.assign(new Error('stale'), { kind: 'http', status: 412 }),
  );
  await renderWorkspace({
    overrides: {
      versionField: 'expectedUpdatedAt',
      toForm: (item) => ({ name: item.name, expectedUpdatedAt: item.updatedAt }),
      toPayload: (value) => value,
    },
  });
  await clickButton('Editar');
  await fillForm('name', 'Meu rascunho');
  await clickButton('Guardar');
  await chooseConflictValue('Usar o valor atual');
  await clickButton('Revi os dados atuais; continuar a editar');

  expect(container.querySelector('#name').value).toBe('Alterado por outra pessoa');
  api.update.mockResolvedValue(latest);
  await clickButton('Guardar');
  expect(api.update).toHaveBeenLastCalledWith('PROD-00001', {
    name: 'Alterado por outra pessoa',
    expectedUpdatedAt: 'v2',
  });
});

test("a stale edit keeps another manager's change to a field the draft did not touch", async () => {
  const fields = [
    { name: 'name', labelKey: 'name', required: true },
    { name: 'description', labelKey: 'description' },
  ];
  const initial = {
    id: 'PROD-00001',
    name: 'Original',
    description: 'Descrição antiga',
    updatedAt: 'v1',
  };
  const latest = { ...initial, description: 'Descrição nova', updatedAt: 'v2' };
  api.list.mockResolvedValue([initial]);
  api.getById = jest.fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce(latest);
  api.update.mockRejectedValueOnce(
    Object.assign(new Error('stale'), { kind: 'http', status: 412 }),
  );
  await renderWorkspace({
    overrides: {
      fields,
      versionField: 'expectedUpdatedAt',
      toForm: (item) => ({
        name: item.name,
        description: item.description,
        expectedUpdatedAt: item.updatedAt,
      }),
      toPayload: (value) => value,
    },
  });
  await clickButton('Editar');
  await fillForm('name', 'Meu rascunho');
  await clickButton('Guardar');

  // No conflict: only this draft changed the name, only the other the description.
  expect(button('Revi os dados atuais; continuar a editar').disabled).toBe(false);
  await clickButton('Revi os dados atuais; continuar a editar');
  api.update.mockResolvedValue({ ...latest, name: 'Meu rascunho' });
  await clickButton('Guardar');
  expect(api.update).toHaveBeenLastCalledWith('PROD-00001', {
    name: 'Meu rascunho',
    description: 'Descrição nova',
    expectedUpdatedAt: 'v2',
  });
});

test('an unknown create outcome stays blocked after leaving and returning to the page (BR25)', async () => {
  api.create.mockRejectedValue(
    Object.assign(new Error('response was lost'), { kind: 'timeout' }),
  );
  await renderWorkspace();
  await clickButton('Criar');
  await fillForm('name', 'Rascunho de criação');
  await clickButton('Guardar');

  // Leave the page and come back.
  act(() => root.unmount());
  root = createRoot(container);
  await renderWorkspace();
  await clickButton('Criar');

  expect(container.textContent).toContain('Verifiquei o resultado');
  expect(button('Guardar').disabled).toBe(true);
  expect(api.create).toHaveBeenCalledTimes(1);

  // Only an explicit confirmation of the real result releases the block.
  await clickButton('Verifiquei o resultado');
  expect(container.textContent).not.toContain('Verifiquei o resultado');
  expect(button('Guardar').disabled).toBe(false);
});

test('repeatable operations are not blocked after an unknown outcome', async () => {
  api.list.mockResolvedValue([{ id: 'CAT-00001', name: 'Categoria' }]);
  api.remove.mockRejectedValue(
    Object.assign(new Error('response was lost'), { kind: 'timeout' }),
  );
  await renderWorkspace();
  await clickButton('Remover');
  await clickButton('Confirmar');
  await clickButton('Confirmar');

  expect(api.remove).toHaveBeenCalledTimes(2);
  expect(container.textContent).not.toContain('Verifiquei o resultado');
});

test('successful empty searches show an empty state rather than an error', async () => {
  api.list.mockResolvedValueOnce([
    { id: 'CAT-00001', name: 'Outra categoria' },
  ]);
  await renderWorkspace();
  const search = container.querySelector('.catalogue-search input');
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  ).set;
  await act(async () => {
    setter.call(search, 'Sem resultados');
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await clickButton('Pesquisar');

  expect(api.list).toHaveBeenLastCalledWith(
    { name: 'Sem resultados' },
    expect.any(AbortSignal),
  );
  expect(container.textContent).toContain('Não foram encontrados registos.');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('manager-only create and row actions are hidden from employees', async () => {
  api.list.mockResolvedValue([{ id: 'CAT-00001', name: 'Categoria' }]);
  await renderWorkspace({ role: 'EMPLOYEE' });

  expect(button('Criar')).toBeUndefined();
  expect(button('Remover')).toBeUndefined();
  expect(container.textContent).toContain('Categoria');
});

describe('BR25: a pending operation is released only after consulting the API', () => {
  const timeout = () =>
    Object.assign(new Error('response was lost'), { kind: 'timeout' });
  const adjust = {
    key: 'adjust',
    nonRepeatable: true,
    labelKey: 'delete',
    fields: [{ name: 'units', labelKey: 'units', type: 'number', required: true }],
    toPayload: (values) => ({ units: Number(values.units) }),
    run: (workspaceApi, item, payload) => workspaceApi.adjust(item.id, payload),
    show: () => true,
    snapshot: (item) => item.units,
    verifyOutcome: async (workspaceApi, pending) => {
      const rows = await workspaceApi.list({});
      const now = rows.find((row) => row.id === pending.recordId)?.units;
      if (now === pending.before + Number(pending.values.units)) return 'applied';
      if (now === pending.before) return 'notApplied';
      return 'unconfirmed';
    },
  };
  const rows = (units) => [{ id: 'CAT-00001', name: 'Categoria', units }];

  // Adjustment times out, the user leaves the page and comes back.
  async function adjustWithTimeoutAndReturn() {
    window.sessionStorage.clear();
    api.adjust = jest.fn().mockRejectedValue(timeout());
    api.list.mockResolvedValue(rows(10));
    await renderWorkspace({ overrides: { rowActions: [adjust] } });
    await clickButton('Remover');
    await fillForm('units', '3');
    await clickButton('Guardar');

    act(() => root.unmount());
    root = createRoot(container);
    await renderWorkspace({ overrides: { rowActions: [adjust] } });
    expect(container.textContent).toContain('Verifiquei o resultado');
  }

  test('not applied: released only after the API check, with the values restored', async () => {
    await adjustWithTimeoutAndReturn();
    await clickButton('Verifiquei o resultado');
    expect(container.textContent).not.toContain('Verifiquei o resultado');
    expect(container.querySelector('input[name="units"]').value).toBe('3');
    expect(api.adjust).toHaveBeenCalledTimes(1);
  });

  test('applied: released and nothing is sent again', async () => {
    await adjustWithTimeoutAndReturn();
    api.list.mockResolvedValue(rows(13));
    await clickButton('Verifiquei o resultado');
    expect(container.textContent).not.toContain('Verifiquei o resultado');
    expect(container.querySelector('input[name="units"]')).toBeNull();
    expect(api.adjust).toHaveBeenCalledTimes(1);
  });

  test('API unreachable or result unclear: the operation stays blocked', async () => {
    await adjustWithTimeoutAndReturn();
    api.list.mockRejectedValueOnce(timeout());
    await clickButton('Verifiquei o resultado');
    expect(container.textContent).toContain('Verifiquei o resultado');

    api.list.mockResolvedValue(rows(20)); // changed by someone else
    await clickButton('Verifiquei o resultado');
    expect(container.textContent).toContain('Verifiquei o resultado');
    expect(api.adjust).toHaveBeenCalledTimes(1);
  });
});
