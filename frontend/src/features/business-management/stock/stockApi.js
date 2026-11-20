const base = '/stock';
const one = (id) => `${base}/${encodeURIComponent(id)}`;
export function createStockApi(request) {
  return Object.freeze({
    list: (query, signal) => request('GET', base, { query, signal }),
    getById: (id, signal) => request('GET', one(id), { signal }),
    create: (body) => request('POST', base, { body }),
    adjust: (id, body) => request('POST', `${one(id)}/adjustments`, { body }),
    stop: (id) => request('DELETE', one(id)),
  });
}
