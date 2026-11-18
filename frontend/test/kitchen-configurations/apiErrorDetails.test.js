import { apiClient } from '../../src/shared/api/apiClient.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const answer = (status, error) => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error }),
  });
};
const details = [
  {
    path: '/kitchen/dimensions/height',
    code: 'INVALID_DIMENSION',
    message: 'height must be between 2 and 10 metres',
    params: { min: 2, max: 10 },
  },
];

describe('ALN-2 ApiError.details (FT03)', () => {
  test('a 422 body with details keeps them', async () => {
    answer(422, {
      message: 'The kitchen configuration content is invalid',
      status: 422,
      details,
    });
    await expect(
      apiClient.post('/kitchen-configurations', { body: {} }),
    ).rejects.toMatchObject({
      status: 422,
      details,
    });
  });

  test('details that are not an array of issues are ignored', async () => {
    answer(422, { message: 'Invalid', status: 422, details: 'nope' });
    const error = await apiClient
      .post('/kitchen-configurations', { body: {} })
      .catch((e) => e);
    expect(error.details).toBeUndefined();
  });

  test('a 500 never carries details', async () => {
    answer(500, { message: 'boom', status: 500, details });
    const error = await apiClient
      .get('/kitchen-configurations')
      .catch((e) => e);
    expect(error.status).toBe(500);
    expect(error.details).toBeUndefined();
  });
});