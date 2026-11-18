/** @jest-environment jsdom */
import { act } from 'react';
import { jest } from '@jest/globals';
import KitchenConfigurationEditorPage from '../../src/features/kitchen-configurations/pages/KitchenConfigurationEditorPage.jsx';
import { STALE_VERSION_MESSAGE } from '../../src/features/kitchen-configurations/kitchenConfigurationApi.js';
import {
  button,
  check,
  clickButton,
  detail,
  httpError,
  layout,
  mount,
  setLocale,
  type,
} from './kitchenTestUtils.jsx';

let view;
let api;

beforeEach(() => {
  view = mount();
  api = {
    create: jest.fn(),
    update: jest.fn(),
    getById: jest.fn(),
    validate: jest.fn(),
  };
});
afterEach(() => view.unmount());

const textarea = () => view.container.querySelector('textarea');
const nameInput = () => view.container.querySelector('input:not([type])');
const issues = () =>
  [...view.container.querySelectorAll('.kitchen-issues li')].map((item) =>
    item.textContent.trim(),
  );
const renderEdit = (initial = detail()) =>
  view.render(
    <KitchenConfigurationEditorPage api={api} mode="edit" initial={initial} />,
  );
const renderCreate = () =>
  view.render(<KitchenConfigurationEditorPage api={api} mode="create" />);
const details = [
  {
    path: '/kitchen/dimensions/height',
    code: 'INVALID_DIMENSION',
    message: 'x',
    params: { min: 2, max: 10, value: 0 },
  },
  {
    path: '/elements/4/placement/scale/y',
    code: 'INVALID_SCALE',
    message: 'x',
    params: { min: 0.01, max: 100, value: 0 },
  },
  {
    path: '/elements/0/model/assetId',
    code: 'UNKNOWN_ASSET',
    message: 'x',
    params: { assetId: 'AST-MDL-OVEN-99' },
  },
];

describe('WEB06 KitchenConfigurationEditorPage', () => {
  test('a syntax error is shown and nothing is sent', async () => {
    await renderCreate();
    await type(nameInput(), 'Kitchen A');
    await type(textarea(), '{ "schemaVersion": 1, }');
    await clickButton(view.container, 'Save');
    expect(api.create).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Invalid JSON at line 1');
    expect(textarea().value).toBe('{ "schemaVersion": 1, }');
  });

  test('FT04 - a 422 lists every issue and keeps the text', async () => {
    api.update.mockRejectedValue(
      httpError(422, 'The kitchen configuration content is invalid', details),
    );
    await renderEdit();
    const text = textarea().value;
    await clickButton(view.container, 'Save');
    expect(api.update).toHaveBeenCalledWith('KCF-00002', {
      name: 'Compact kitchen',
      content: layout(),
      version: 3,
    });
    expect(issues()).toEqual([
      '/kitchen/dimensions/height Must be between 2 and 10 metres.',
      '/elements/4/placement/scale/y Must be between 0.01 and 100.',
      '/elements/0/model/assetId Asset “AST-MDL-OVEN-99” does not exist in the catalogue.',
    ]);
    expect(textarea().value).toBe(text);
    expect(view.container.textContent).toContain(
      'The stored configuration was not changed',
    );
    expect(view.container.querySelector('.feedback--success')).toBeNull();
  });

  test('FT05 - a stale version keeps the draft, offers the reload and disables Save; one request on double click', async () => {
    let reject;
    api.update.mockReturnValue(new Promise((_, fail) => (reject = fail)));
    await renderEdit();
    await type(nameInput(), 'Kitchen B');
    await act(async () => {
      button(view.container, 'Save').click();
      button(view.container, 'Save').click();
    });
    expect(api.update).toHaveBeenCalledTimes(1);
    await act(async () => reject(httpError(409, STALE_VERSION_MESSAGE)));
    expect(view.container.textContent).toContain(
      'This configuration was changed by another user',
    );
    expect(button(view.container, 'Reload latest version')).toBeDefined();
    expect(button(view.container, 'Save').disabled).toBe(true);
    expect(nameInput().value).toBe('Kitchen B');
  });

    test('FT16 - name and JSON are locked while saving; nothing typed meanwhile is lost', async () => {
    let resolve;
    api.update.mockReturnValue(new Promise((done) => (resolve = done)));
    await renderEdit();
    await type(nameInput(), 'Kitchen B');
    const sent = textarea().value;
    await clickButton(view.container, 'Save');
    expect(nameInput().readOnly).toBe(true);
    expect(textarea().readOnly).toBe(true);
    expect(view.container.querySelector('input[type="file"]').disabled).toBe(
      true,
    );
    await type(nameInput(), 'Kitchen typed while saving');
    await type(textarea(), '{ "typed": "while saving" }');
    expect(nameInput().value).toBe('Kitchen B');
    expect(textarea().value).toBe(sent);
    await act(async () =>
      resolve(detail({ name: 'Kitchen B', version: 4, content: layout() })),
    );
    expect(nameInput().readOnly).toBe(false);
    expect(textarea().readOnly).toBe(false);
    expect(nameInput().value).toBe('Kitchen B');
    expect(JSON.parse(textarea().value)).toEqual(layout());
    expect(view.container.textContent).toContain(
      'Configuration saved (version 4)',
    );
    await type(nameInput(), 'Kitchen C');
    expect(nameInput().value).toBe('Kitchen C');
  });

  test('FT10 - recovery rebases the save on the reloaded version (clarification 15)', async () => {
    api.update.mockRejectedValueOnce(httpError(409, STALE_VERSION_MESSAGE));
    const latestContent = layout();
    latestContent.kitchen.dimensions.width = 14;
    api.getById.mockResolvedValue(
      detail({
        version: 4,
        content: latestContent,
        updatedAt: '2026-11-12T11:00:00.000Z',
      }),
    );
    await renderEdit();
    await type(nameInput(), 'Kitchen B');
    await clickButton(view.container, 'Save');
    await clickButton(view.container, 'Reload latest version');
    const panel = view.container.querySelector('.kitchen-conflict').textContent;
    expect(panel).toContain('/content/kitchen/dimensions/width: 12 → 14');
    expect(panel).toContain('/name: "Compact kitchen" → "Kitchen B"');
    expect(panel).toMatch(/Conflicts\s*None\./);
    expect(button(view.container, 'Save').disabled).toBe(true);
    await clickButton(view.container, 'Continue with the rebased version');
    expect(JSON.parse(textarea().value).kitchen.dimensions.width).toBe(14);
    expect(button(view.container, 'Save').disabled).toBe(true);
    await check(
      view.container.querySelector('.kitchen-conflict__review input'),
    );
    expect(button(view.container, 'Save').disabled).toBe(false);
    api.update.mockResolvedValue(
      detail({ name: 'Kitchen B', version: 5, content: latestContent }),
    );
    await clickButton(view.container, 'Save');
    expect(api.update).toHaveBeenLastCalledWith('KCF-00002', {
      name: 'Kitchen B',
      content: latestContent,
      version: 4,
    });
    expect(view.container.textContent).toContain(
      'Configuration saved (version 5)',
    );
    expect(view.container.querySelector('.kitchen-conflict')).toBeNull();
  });

  test('FT11 - switching the language keeps name, JSON, issues and draft; no request', async () => {
    api.update.mockRejectedValueOnce(httpError(422, 'invalid', details));
    await renderEdit();
    await type(nameInput(), 'Kitchen typed');
    await type(textarea(), JSON.stringify(layout({ units: 'meters' })));
    const file = new File([JSON.stringify(layout())], 'kitchen-a.json', {
      type: 'application/json',
    });
    const input = view.container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    await act(async () =>
      input.dispatchEvent(new Event('change', { bubbles: true })),
    );
    await act(async () => {});
    expect(textarea().value).toBe(JSON.stringify(layout()));
    await clickButton(view.container, 'Save');
    const textarea0 = textarea();
    const english = issues();
    api.update.mockClear();
    await setLocale('pt-PT');
    expect(textarea()).toBe(textarea0);
    expect(nameInput().value).toBe('Kitchen typed');
    expect(textarea().value).toBe(JSON.stringify(layout()));
    expect(issues()[0]).toBe(
      '/kitchen/dimensions/height Deve estar entre 2 e 10 metros.',
    );
    expect(button(view.container, 'Guardar')).toBeDefined();
    await setLocale('en-GB');
    expect(issues()).toEqual(english);
    expect(api.update).not.toHaveBeenCalled();
    expect(api.getById).not.toHaveBeenCalled();
  });

  test('a duplicate name is a field error', async () => {
    api.create.mockRejectedValue(
      httpError(409, 'A kitchen configuration with this name already exists'),
    );
    await renderCreate();
    await type(nameInput(), 'Compact kitchen');
    await type(textarea(), JSON.stringify(layout()));
    await clickButton(view.container, 'Save');
    expect(view.container.querySelector('.field-error').textContent).toBe(
      'A configuration with this name already exists.',
    );
  });

  test('dry-run validation shows the issues without saving', async () => {
    api.validate.mockResolvedValue({ valid: false, issues: details });
    await renderEdit();
    await clickButton(view.container, 'Validate');
    expect(api.validate).toHaveBeenCalledWith(layout());
    expect(issues()).toHaveLength(3);
    expect(api.update).not.toHaveBeenCalled();
  });
});