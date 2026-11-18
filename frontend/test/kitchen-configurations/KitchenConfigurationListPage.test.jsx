/** @jest-environment jsdom */
import { act } from 'react';
import { jest } from '@jest/globals';
import KitchenConfigurationListPage from '../../src/features/kitchen-configurations/pages/KitchenConfigurationListPage.jsx';
import { button, clickButton, httpError, mount } from './kitchenTestUtils.jsx';

const summary = (id, name, status = 'INACTIVE') => ({
  id,
  name,
  status,
  version: 1,
  elementCount: 10,
  updatedAt: '2026-11-12T10:15:00.000Z',
  activatedAt: status === 'ACTIVE' ? '2026-11-12T10:20:00.000Z' : null,
});

let view;
let api;
beforeEach(() => {
  view = mount();
  api = { list: jest.fn(), activate: jest.fn(), remove: jest.fn() };
});
afterEach(() => view.unmount());

const render = () =>
  view.render(<KitchenConfigurationListPage api={api} />, {
    path: '/kitchen/configurations',
    at: '/kitchen/configurations',
    // Documented VIS01 route (WEB01 moduleRoutes); the viewer itself is VIS01.
    routes: { '/kitchen/viewer': <p>kitchen viewer route</p> },
  });
const row = (id) =>
  view.container.querySelector(`[data-configuration-id="${id}"]`);
const confirm = () =>
  act(async () => {
    view.container
      .querySelector('[role="alertdialog"] .button--danger')
      .click();
  });

describe('WEB06 KitchenConfigurationListPage', () => {
  test('FT06 - confirmed activation re-reads the list, confirms and offers the viewer; cancel sends nothing', async () => {
    api.list
      .mockResolvedValueOnce([
        summary('KCF-00001', 'Compact kitchen', 'ACTIVE'),
        summary('KCF-00002', 'Extended kitchen'),
      ])
      .mockResolvedValueOnce([
        summary('KCF-00001', 'Compact kitchen'),
        summary('KCF-00002', 'Extended kitchen', 'ACTIVE'),
      ]);
    api.activate.mockResolvedValue({
      activeConfiguration: summary('KCF-00002', 'Extended kitchen', 'ACTIVE'),
      previousActiveConfigurationId: 'KCF-00001',
    });
    await render();
    await clickButton(row('KCF-00002'), 'Activate');
    expect(
      view.container.querySelector('[role="alertdialog"]').textContent,
    ).toContain('“Compact kitchen” will become inactive');
    await clickButton(view.container, 'Cancel');
    expect(api.activate).not.toHaveBeenCalled();
    await clickButton(row('KCF-00002'), 'Activate');
    await confirm();
    expect(api.activate).toHaveBeenCalledWith('KCF-00002');
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(view.container.textContent).toContain(
      'Extended kitchen (KCF-00002) is now the active configuration.',
    );
    await clickButton(view.container, 'Open / reload the kitchen viewer');
    expect(view.container.textContent).toContain('kitchen viewer route');
  });

  test('FT07 - delete disabled for the active row; inactive deleted; a 409 keeps the row', async () => {
    api.list
      .mockResolvedValueOnce([
        summary('KCF-00001', 'Compact kitchen', 'ACTIVE'),
        summary('KCF-00002', 'Extended kitchen'),
        summary('KCF-00003', 'Other kitchen'),
      ])
      .mockResolvedValueOnce([
        summary('KCF-00001', 'Compact kitchen', 'ACTIVE'),
        summary('KCF-00003', 'Other kitchen'),
      ])
      .mockResolvedValueOnce([
        summary('KCF-00001', 'Compact kitchen', 'ACTIVE'),
        summary('KCF-00003', 'Other kitchen', 'ACTIVE'),
      ]);
    await render();
    expect(button(row('KCF-00001'), 'Delete').disabled).toBe(true);
    api.remove.mockResolvedValueOnce(null);
    await clickButton(row('KCF-00002'), 'Delete');
    await confirm();
    expect(row('KCF-00002')).toBeNull();
    expect(view.container.textContent).toContain('Configuration deleted.');
    api.remove.mockRejectedValueOnce(
      httpError(
        409,
        'The active kitchen configuration cannot be deleted. Activate another configuration first.',
      ),
    );
    await clickButton(row('KCF-00003'), 'Delete');
    await confirm();
    expect(row('KCF-00003')).not.toBeNull();
    expect(view.container.textContent).toContain(
      'The active configuration cannot be deleted.',
    );
  });

  test('FT09 - empty list and no active configuration', async () => {
    api.list.mockResolvedValueOnce([]);
    await render();
    expect(view.container.textContent).toContain(
      'There are no kitchen configurations yet.',
    );
    expect(view.container.textContent).toContain('No configuration is active');
    view.unmount();
    view = mount();
    api.list.mockResolvedValueOnce([summary('KCF-00001', 'Compact kitchen')]);
    await render();
    expect(view.container.textContent).toContain('No configuration is active');
    expect(
      button(view.container, 'Open / reload the kitchen viewer'),
    ).toBeUndefined();
  });

  test('a failed activation (422) keeps the previous active one and explains it', async () => {
    api.list.mockResolvedValue([
      summary('KCF-00001', 'Compact kitchen', 'ACTIVE'),
      summary('KCF-00002', 'Extended kitchen'),
    ]);
    api.activate.mockRejectedValue(
      httpError(422, 'The kitchen configuration content is invalid', []),
    );
    await render();
    await clickButton(row('KCF-00002'), 'Activate');
    await confirm();
    expect(view.container.textContent).toContain(
      'The active configuration did not change.',
    );
    expect(view.container.textContent).toContain(
      'Active configuration: Compact kitchen (KCF-00001).',
    );
  });
});