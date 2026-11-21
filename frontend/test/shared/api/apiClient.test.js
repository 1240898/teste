import { ApiError } from '../../../src/shared/api/ApiError.js';
import { apiClient, setAuthFailureHandler } from '../../../src/shared/api/apiClient.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthFailureHandler(null);
  jest.useRealTimers();
});

it('preserves an opaque ID and keeps the token in the header', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: 'PROD-00123' }),
  });

  await expect(
    apiClient.get('/products/PROD-00123', {
      accessToken: 'in-memory-token',
    }),
  ).resolves.toEqual({ id: 'PROD-00123' });
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8080/api/v1/products/PROD-00123',
    expect.objectContaining({
      credentials: 'omit',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer in-memory-token',
      },
    }),
  );
});

it('omits Authorization when no access token is supplied', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ status: 'ok' }),
  });

  await expect(apiClient.get('/health')).resolves.toEqual({ status: 'ok' });
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8080/api/v1/health',
    expect.objectContaining({ headers: { Accept: 'application/json' } }),
  );
});

it('preserves the caller-encoded path segment and encodes query values separately', async () => {
  const id = 'PROD/a?b#c';
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id }),
  });

  await expect(
    apiClient.get(`/products/${encodeURIComponent(id)}`, {
      query: { name: 'a&b' },
    }),
  ).resolves.toEqual({ id });
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8080/api/v1/products/PROD%2Fa%3Fb%23c?name=a%26b',
    expect.objectContaining({ method: 'GET' }),
  );
});

it('sends a POST body as JSON and returns null without parsing a 204 response', async () => {
  const json = jest.fn();
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204, json });

  await expect(
    apiClient.post('/planning', { body: { forecastId: 'FORECAST-01' } }),
  ).resolves.toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8080/api/v1/planning',
    expect.objectContaining({
      method: 'POST',
      body: '{"forecastId":"FORECAST-01"}',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }),
  );
  expect(json).not.toHaveBeenCalled();
});

it('uploads a document as bytes and reads the authenticated download as a blob', async () => {
  const file = new Blob(['Shared procedure']);
  const path = '/shared-resources/example.txt';
  const accessToken = 'in-memory-token';
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ name: 'example.txt' }) })
    .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => file });

  await expect(apiClient.post(path, {
    body: file,
    accessToken,
    headers: { 'X-Confirm-Shared-Publication': 'true' },
  })).resolves.toEqual({ name: 'example.txt' });
  expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining(path), expect.objectContaining({
    body: file,
    headers: expect.objectContaining({
      'Content-Type': 'application/octet-stream',
      'X-Confirm-Shared-Publication': 'true',
      Authorization: `Bearer ${accessToken}`,
    }),
  }));

  await expect(apiClient.get(path, { accessToken, responseType: 'blob' })).resolves.toBe(file);
  expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining(path), expect.objectContaining({
    headers: expect.objectContaining({
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${accessToken}`,
    }),
  }));
});

it.each([401, 403, 503])(
  'preserves HTTP status %s without exposing request headers or the access token',
  async (status) => {
    const accessToken = 'in-memory-token';
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ error: { message: 'Action unavailable' } }),
    });
    const error = await apiClient
      .post('/planning', { accessToken })
      .catch((failure) => failure);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'http',
      status,
      message:
        status < 500 ? 'Action unavailable' : 'Request failed with status 503',
    });
    expect(error).not.toHaveProperty('headers');
    expect(error.message).not.toContain(accessToken);
    const serialisedError = JSON.stringify(error);
    expect(serialisedError).not.toContain(accessToken);
    expect(serialisedError).not.toMatch(/"(?:headers|authorization)"/i);
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

it('distinguishes an invalid success payload from a connection failure', async () => {
  globalThis.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError();
      },
    })
    .mockRejectedValueOnce(new TypeError());
  await expect(apiClient.get('/health')).rejects.toMatchObject({
    kind: 'invalid-response',
    status: 200,
  });
  await expect(apiClient.get('/health')).rejects.toMatchObject({
    kind: 'network',
    status: 0,
  });
});

it('aborts on timeout and distinguishes cancellation by a caller', async () => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Aborted')), {
          once: true,
        });
      }),
  );
  const timedRequest = expect(apiClient.get('/health')).rejects.toMatchObject({
    kind: 'timeout',
  });
  await jest.advanceTimersByTimeAsync(15000);
  await timedRequest;

  const controller = new AbortController();
  const cancelled = expect(
    apiClient.get('/health', { signal: controller.signal }),
  ).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await cancelled;
});

it.each([
  'https://other.example.org/',
  '//other.example.org',
  '/../admin',
  '/%2e%2e/admin',
  '/products/PROD?unencoded',
  '/products/PROD#unencoded',
])('refuses an invalid API path before sending a request: %s', async (path) => {
  globalThis.fetch = jest.fn();
  await expect(
    apiClient.get(path, { accessToken: 'in-memory-token' }),
  ).rejects.toThrow(TypeError);
  expect(fetch).not.toHaveBeenCalled();
});

describe('WEB03 global 401/403 handler (BR 13)', () => {
  const answer = (status, message = 'Denied') => ({
    ok: false,
    status,
    json: async () => ({ error: { message, status } }),
  });

  it.each([401, 403])(
    'awaits the handler for a business %i BEFORE rejecting, without retrying',
    async (status) => {
      const events = [];
      setAuthFailureHandler(async (code, context) => {
        events.push(['handler', code, context]);
        await Promise.resolve();
        events.push(['handler done']);
      });
      globalThis.fetch = jest.fn().mockResolvedValue(answer(status));

      await expect(
        apiClient.get('/stock', { accessToken: 'token-1' }).catch((error) => {
          events.push(['rejected', error.status]);
          throw error;
        }),
      ).rejects.toMatchObject({ status, kind: 'http' });
      expect(events).toEqual([
        ['handler', status, { accessToken: 'token-1' }],
        ['handler done'],
        ['rejected', status],
      ]);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('never invokes the handler for authentication requests (skipAuthFailureHandler)', async () => {
    const handler = jest.fn();
    setAuthFailureHandler(handler);
    globalThis.fetch = jest.fn().mockResolvedValue(answer(401));

    await expect(
      apiClient.get('/auth/me', {
        accessToken: 'token-1',
        skipAuthFailureHandler: true,
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0][1]).not.toHaveProperty('skipAuthFailureHandler');
  });

  it('ignores other statuses and connection failures', async () => {
    const handler = jest.fn();
    setAuthFailureHandler(handler);
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(answer(404, 'Not found'))
      .mockRejectedValueOnce(new TypeError('offline'));

    await expect(apiClient.get('/stock')).rejects.toMatchObject({
      status: 404,
    });
    await expect(apiClient.get('/stock')).rejects.toMatchObject({
      kind: 'network',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps the original API error when the handler fails', async () => {
    setAuthFailureHandler(async () => {
      throw new Error('handler failure');
    });
    globalThis.fetch = jest.fn().mockResolvedValue(answer(403));

    await expect(apiClient.get('/stock')).rejects.toBeInstanceOf(ApiError);
  });

  it('unregisters only the handler it registered', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const removeFirst = setAuthFailureHandler(first);
    setAuthFailureHandler(second);
    removeFirst();
    globalThis.fetch = jest.fn().mockResolvedValue(answer(403));

    await expect(apiClient.get('/stock')).rejects.toBeDefined();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
