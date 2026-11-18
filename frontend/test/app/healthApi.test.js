import { getHealth } from '../../src/app/services/healthApi.js';

describe('getHealth', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the health payload when the backend responds', async () => {
    const payload = {
      status: 'ok',
      version: '1.0.0',
      timestamp: '2026-01-01T00:00:00.000Z',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    await expect(getHealth()).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/health',
      expect.objectContaining({ method: 'GET', credentials: 'omit' }),
    );
  });
});
