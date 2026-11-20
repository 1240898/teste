const base = '/customers';
const one = (id) => `${base}/${encodeURIComponent(id)}`;
export function createCustomerApi(request) {
  return Object.freeze({
    list: (query, signal) => request('GET', base, { query, signal }),
    getById: (id, signal) => request('GET', one(id), { signal }),
    create: (body) => request('POST', base, { body }),
    update: (id, body) => request('PUT', one(id), { body }),
    activate: (id) => request('PATCH', `${one(id)}/activate`),
    deactivate: (id) => request('PATCH', `${one(id)}/deactivate`),
  });
}
