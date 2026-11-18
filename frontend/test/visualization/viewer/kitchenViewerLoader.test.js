import { ApiError } from '../../../src/shared/api/ApiError.js';
import { loadActiveKitchen } from '../../../src/visualization/viewer/kitchenViewerLoader.js';

const issue = {
  path: '',
  code: 'NO_ACTIVE_CONFIGURATION',
  message: 'No active kitchen configuration',
};
const body = {
  id: 'KCF-00001',
  name: 'Kitchen',
  status: 'ACTIVE',
  version: 1,
  content: {
    schemaVersion: 1,
    units: 'meters',
    kitchen: { dimensions: { width: 8, depth: 5, height: 3 } },
    elements: [],
  },
  assets: {},
};

test('requests the active configuration through the injected adapter and forwards its signal', async () => {
  const request = jest.fn().mockResolvedValue(body);
  const { signal } = new AbortController();
  expect(await loadActiveKitchen(request, signal)).toEqual({
    status: 'loading-assets',
    configuration: body,
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(
    'GET',
    '/kitchen-configurations/active',
    { signal },
  );
});

test('distinguishes an invalid success body from an HTTP failure', async () => {
  expect(await loadActiveKitchen(async () => ({}))).toEqual({
    status: 'invalid',
  });
});

test.each([
  [new ApiError(404, issue.message, 'http', [issue]), 'empty'],
  [
    new ApiError(404, 'Cannot GET /api/v1/kitchen-configurations/active'),
    'error',
  ],
  [
    new ApiError(404, issue.message, 'http', [{ ...issue, code: 'other' }]),
    'error',
  ],
  [new ApiError(401, 'Unauthorized'), 'expired'],
  [new ApiError(403, 'Forbidden'), 'denied'],
  [new ApiError(500, 'Internal error'), 'error'],
  ...['network', 'timeout', 'invalid-response'].map((kind) => [
    new ApiError(0, kind, kind),
    'error',
  ]),
  [new ApiError(0, 'Aborted', 'aborted'), 'cancelled'],
])('maps %p to %s', async (error, status) => {
  const result = await loadActiveKitchen(jest.fn().mockRejectedValue(error));
  expect(result).toEqual(
    status === 'error' ? { status, reason: 'request' } : { status },
  );
});

test('ignores late data after cancelling', async () => {
  const controller = new AbortController();
  const request = jest.fn(async () => {
    controller.abort();
    return body;
  });
  expect(await loadActiveKitchen(request, controller.signal)).toEqual({
    status: 'cancelled',
  });
  await loadActiveKitchen(request, controller.signal);
  expect(request).toHaveBeenCalledTimes(1);
});
