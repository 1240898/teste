/** @jest-environment jsdom */
import { act } from 'react';
import {
  mount,
  clickButton,
  setLocale,
  type,
} from '../kitchen-configurations/kitchenTestUtils.jsx';
import PlanningPage from '../../src/features/planning/PlanningPage.jsx';
import { useExecutionTracker } from '../../src/features/planning/useExecutionTracker.js';

let ui;
beforeEach(() => {
  ui = mount();
});
afterEach(() => {
  ui.unmount();
  jest.useRealTimers();
});
const broken = () =>
  Object.assign(new Error('lost'), { kind: 'network', status: 0 });
const saved = {
  id: 'F',
  version: '1',
  name: 'Weekend',
  startDate: '2026-11-23',
  endDate: '2026-11-24',
  entries: [],
};
const summary = { id: 'F', version: '1', name: 'Weekend' };
const scenario = { id: 'S', version: '2' };
const data = {
  days: [
    {
      dueDate: '2026-11-23',
      productId: 'drink',
      requiredUnits: 12,
      unmetAtDeadlineUnits: 8,
    },
  ],
  proposals: [],
  warnings: [{ code: 'UNKNOWN_CAPACITY', supplierId: 'A', productId: 'drink' }],
};
const completed = (id) => ({
  executionId: id,
  status: 'COMPLETED',
  retryable: false,
  result: {
    forecast: summary,
    supplierScenario: scenario,
    planningType: 'REQUIREMENTS_PLANNING',
    simulation: true,
    mode: 'current',
    snapshotId: 'snapshot-' + id,
    stockSnapshotId: 'stock-' + id,
    referenceDate: '2026-11-20',
    bomIds: ['bom'],
    data,
    provenance: [],
  },
});
function defaults(method, path) {
  if (path === '/planning/forecast-options')
    return {
      products: [
        {
          productId: 'pizza',
          name: 'Pizza',
          isPizza: true,
          sizes: [{ id: 'M', name: 'Medium' }],
        },
        { productId: 'drink', name: 'Lemonade', isPizza: false, sizes: [] },
      ],
    };
  if (path === '/planning/forecasts' && method === 'GET')
    return { items: [summary] };
  if (path === '/planning/forecasts/F') return saved;
  if (path === '/planning/supplier-scenarios') return { items: [scenario] };
  throw new Error('Unexpected ' + method + ' ' + path);
}
async function choose(select, value) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
test('retains a bilingual draft, chooses applicable sizes, and retries the identical create after response loss', async () => {
  const requests = [];
  const request = jest.fn(async (method, path, options) => {
    if (method === 'POST') {
      requests.push(options.body);
      if (requests.length === 1) throw broken();
      return summary;
    }
    return defaults(method, path);
  });
  await ui.render(<PlanningPage request={request} />);
  const form = ui.container.querySelector('form');
  await type(form.querySelector('input'), 'Weekend');
  const [start, end] = form.querySelectorAll('input[type=date]');
  await type(start, '2026-11-23');
  await type(end, '2026-11-24');
  await clickButton(form, 'Add entry');
  await choose(form.querySelector('select'), 'pizza');
  await choose(form.querySelectorAll('select')[1], 'M');
  await choose(form.querySelector('select'), 'drink');
  expect(form.querySelectorAll('select')).toHaveLength(1);
  await setLocale('pt-PT');
  expect(form.querySelector('input').value).toBe('Weekend');
  await setLocale('en-GB');
  await clickButton(form, 'Save');
  expect(requests).toHaveLength(1);
  expect(form.querySelector('fieldset').disabled).toBe(true);
  await clickButton(form, 'Try again');
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[1].entries[0]).toMatchObject({
    productId: 'drink',
    quantity: 0,
  });
  expect(ui.container.textContent).toContain('Forecast saved.');
});
test('a failed lookup leaves the current unsaved draft editable', async () => {
  const request = async (method, path) => {
    if (path === '/planning/forecasts/F') throw broken();
    return defaults(method, path);
  };
  await ui.render(<PlanningPage request={request} />);
  const form = ui.container.querySelector('form');
  await type(form.querySelector('input'), 'Unsaved');
  await choose(ui.container.querySelector('select'), 'F');
  expect(form.querySelector('input').value).toBe('Unsaved');
  expect(form.querySelector('fieldset').disabled).toBe(false);
});
test('a stale edit must reload the current forecast before another save', async () => {
  let reads = 0;
  const request = jest.fn(async (method, path) => {
    if (path === '/planning/forecasts/F' && method === 'GET')
      return ++reads === 1
        ? saved
        : { ...saved, version: '2', name: 'Changed by another manager' };
    if (method === 'PUT')
      throw Object.assign(new Error(), { status: 409, code: 'STALE_VERSION' });
    return defaults(method, path);
  });
  await ui.render(<PlanningPage request={request} />);
  const form = ui.container.querySelector('form');
  await choose(ui.container.querySelector('select'), 'F');
  await type(form.querySelector('input'), 'My changes');
  await clickButton(form, 'Save');
  expect(form.querySelector('input').value).toBe('My changes');
  expect(
    form.querySelector('button[type=submit]') ?? form.querySelector('.button'),
  ).toHaveProperty('disabled', true);
  await clickButton(form, 'Reload saved version');
  expect(form.querySelector('input').value).toBe('Changed by another manager');
});
test('a completed plan can be compared with another saved version of the same type', async () => {
  const request = async (method, path) => {
    if (path === '/planning/executions')
      return {
        items: ['X', 'Y'].map((id) => ({
          ...completed(id),
          planningType: 'REQUIREMENTS_PLANNING',
          forecastId: 'F',
          forecastVersion: '1',
        })),
        nextCursor: null,
      };
    if (path.endsWith('/result')) return completed(path.split('/').at(-2));
    return defaults(method, path);
  };
  await ui.render(<PlanningPage request={request} />);
  await clickButton(ui.container, 'Runs and results');
  await clickButton(ui.container, 'View');
  await clickButton(ui.container, 'Compare with open result');
  expect(ui.container.querySelectorAll('article')).toHaveLength(2);
  expect(ui.container.textContent).toContain('snapshot-X');
  expect(ui.container.textContent).toContain('snapshot-Y');
  expect(ui.container.textContent).toContain(
    'Delivery depends on supplier availability',
  );
});
test('a lost confirmation is recovered by reading that preview before another write', async () => {
  const document = { suppliers: [{ id: 'A' }], products: [] };
  const preview = {
    previewId: 'P',
    expiresAt: '2026-11-22',
    document,
    withoutOffers: [{ name: 'Lemonade', productId: 'drink' }],
  };
  const request = jest.fn(async (method, path) => {
    if (method === 'POST') return preview;
    if (method === 'PUT') throw broken();
    if (path.endsWith('/P'))
      return { ...preview, status: 'CONFIRMED', scenario };
    return defaults(method, path);
  });
  await ui.render(<PlanningPage request={request} />);
  await clickButton(ui.container, 'Supplier scenarios');
  const file = ui.container.querySelector('input[type=file]');
  Object.defineProperty(file, 'files', {
    value: [{ text: async () => JSON.stringify(document) }],
  });
  await act(async () =>
    file.dispatchEvent(new Event('change', { bubbles: true })),
  );
  expect(ui.container.textContent).toContain(
    'Products with no configured supplier',
  );
  await clickButton(ui.container, 'Confirm reviewed scenario');
  await clickButton(ui.container, 'Check saved status');
  expect(request.mock.calls.filter(([m]) => m === 'PUT')).toHaveLength(1);
  expect(ui.container.textContent).toContain('Scenario confirmed.');
});
test('lost execution response polls one ID, stops at expiry and retries the original selection', async () => {
  jest.useFakeTimers();
  let tracker;
  const original = { executionId: 'X', forecastId: 'F', forecastVersion: '1' };
  const api = {
    start: jest
      .fn()
      .mockRejectedValueOnce(broken())
      .mockResolvedValueOnce(completed('X')),
    result: jest
      .fn()
      .mockResolvedValueOnce({
        executionId: 'X',
        status: 'RUNNING',
        retryable: false,
      })
      .mockResolvedValueOnce({
        executionId: 'X',
        status: 'RUNNING',
        retryable: true,
        request: original,
      }),
  };
  function Probe() {
    tracker = useExecutionTracker(api);
    return null;
  }
  await ui.render(<Probe />);
  await act(async () => {
    await Promise.all([
      tracker.track('X', original, true),
      tracker.track('X', original, true),
    ]);
  });
  expect(api.start).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTimeAsync(1000));
  expect(tracker.state.retryable).toBe(true);
  await act(async () => jest.advanceTimersByTimeAsync(5000));
  expect(api.result).toHaveBeenCalledTimes(2);
  await act(async () => tracker.track('X', tracker.state.request, true));
  expect(tracker.state.status).toBe('COMPLETED');
  expect(api.start.mock.calls.map(([body]) => body)).toEqual([
    original,
    original,
  ]);
});
test.each([
  ['EXECUTION_NOT_FOUND', true],
  ['UNREGISTERED', false],
])('404 code %s controls manual retry', async (code, expected) => {
  let tracker;
  const api = {
    start: async () => {
      throw broken();
    },
    result: async () => {
      throw Object.assign(new Error(), { status: 404, code });
    },
  };
  function Probe() {
    tracker = useExecutionTracker(api);
    return null;
  }
  await ui.render(<Probe />);
  await act(async () => tracker.track('X', { executionId: 'X' }, true));
  expect(tracker.state.retryable).toBe(expected);
});
