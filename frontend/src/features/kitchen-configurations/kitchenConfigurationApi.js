const BASE = '/kitchen-configurations';
const one = (id) => `${BASE}/${encodeURIComponent(id)}`;

/**
 * WEB06 HTTP adapter (WEB01 convention): one function per endpoint, DTO in /
 * DTO out, ids encoded, no cache and no business rules. `request` is the
 * session-bound function supplied by ModulePage (bearer token, 401/403
 * reaction of WEB03). getActive() is the same contract used by VIS01.
 */
export function createKitchenConfigurationApi(request) {
  return Object.freeze({
    list: (signal) => request('GET', BASE, { signal }),
    getById: (id, signal) => request('GET', one(id), { signal }),
    getActive: (signal) => request('GET', `${BASE}/active`, { signal }),
    create: ({ name, content }) =>
      request('POST', BASE, { body: { name, content } }),
    update: (id, { name, content, version }) =>
      request('PUT', one(id), { body: { name, content, version } }),
    remove: (id) => request('DELETE', one(id)),
    activate: (id) => request('POST', `${one(id)}/activation`),
    validate: (content) =>
      request('POST', `${BASE}/validation`, { body: { content } }),
    listAssets: (signal) => request('GET', '/kitchen-assets', { signal }),
  });
}

// Messages of the back end used to tell apart the two kinds of 409 of a save.
export const STALE_VERSION_MESSAGE =
  'This kitchen configuration was changed by another user. Reload it before saving.';
export const DUPLICATE_NAME_MESSAGE =
  'A kitchen configuration with this name already exists';