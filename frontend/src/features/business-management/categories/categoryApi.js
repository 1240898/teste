const base = '/categories';
const one = (id) => `${base}/${encodeURIComponent(id)}`;
export function createCategoryApi(request) {
  return Object.freeze({
    list: (query, signal) => request('GET', base, { query, signal }),
    getById: (id, signal) => request('GET', one(id), { signal }),
    create: (body) => request('POST', base, { body }),
    update: (id, body) => request('PUT', one(id), { body }),
    remove: (id) => request('DELETE', one(id)),
  });
}
