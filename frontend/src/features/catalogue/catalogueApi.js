import { apiClient } from '../../shared/api/apiClient.js';

// WEB03 (BR 4, BR 14) with BCK11: the sellable catalogue is public. Requests
// carry no access token and never trigger the session 401/403 reaction, so a
// Guest and a signed-in user read exactly the same public answer.
const publicRequest = { skipAuthFailureHandler: true };

export const catalogueApi = Object.freeze({
  /** GET /catalogue, optionally filtered by a pizza component name. */
  list: ({ componentName, signal } = {}) =>
    apiClient.get('/catalogue', {
      ...publicRequest,
      signal,
      query: componentName ? { componentName } : undefined,
    }),

  /** GET /catalogue/:productId */
  get: (productId, { signal } = {}) =>
    apiClient.get(`/catalogue/${encodeURIComponent(productId)}`, {
      ...publicRequest,
      signal,
    }),
});