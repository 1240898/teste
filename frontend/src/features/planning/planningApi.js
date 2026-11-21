const root = '/planning';
const one = encodeURIComponent;
export function planningApi(request) {
  const get = (path, options) => request('GET', root + path, options);
  async function execution(method, path, options) {
    try {
      return await request(method, root + '/executions' + path, options);
    } catch (error) {
      if (error.status === 404 && !error.code)
        error.code = 'planExecutionUnavailable';
      throw error;
    }
  }
  return {
    forecasts: () => get('/forecasts'),
    options: () => get('/forecast-options'),
    getForecast: (id) => get('/forecasts/' + one(id)),
    create: (body) => request('POST', root + '/forecasts', { body }),
    update: (id, body) =>
      request('PUT', root + '/forecasts/' + one(id), { body }),
    archive: (id, version) =>
      request('DELETE', root + '/forecasts/' + one(id), { query: { version } }),
    exportProducts: () => get('/products/export'),
    preview: (body) =>
      request('POST', root + '/supplier-scenario-previews', { body }),
    getPreview: (id) => get('/supplier-scenario-previews/' + one(id)),
    confirm: (id) =>
      request(
        'PUT',
        root + '/supplier-scenario-previews/' + one(id) + '/confirmation',
      ),
    scenarios: () => get('/supplier-scenarios'),
    start: (body, signal) => execution('POST', '', { body, signal }),
    result: (id, signal) =>
      execution('GET', '/' + one(id) + '/result', { signal }),
    history: (cursor) =>
      execution('GET', '', cursor ? { query: { cursor } } : {}),
  };
}

// getRandomValues also works on local HTTP installations without randomUUID.
export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

export const uncertain = (error) =>
  error?.status >= 500 ||
  ['network', 'timeout', 'invalid-response', 'aborted'].includes(error?.kind);
