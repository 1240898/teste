import { apiClient } from '../../../shared/api/apiClient.js';

export const ACTIVATION_STATE_KEY = 'oidc_activation_state';
export const ACTIVATION_PASSWORD_REQUIRED =
  'Password is required to activate this account.';

function activationRequest(path, body, options = {}) {
  return apiClient.post(`/users/activation/${path}`, {
    ...options,
    body,
    skipAuthFailureHandler: true,
  });
}

export const activationApi = {
  inspect: (token, signal) =>
    activationRequest('inspect', { token }, { signal }),
  local: (token, password) => activationRequest('local', { token, password }),
  startExternal: (token) => activationRequest('external/start', { token }),
  completeExternal: (code, state) =>
    activationRequest(
      'external/complete',
      { code, state },
      { credentials: 'include' },
    ),
};
