import { apiClient } from '../../../shared/api/apiClient.js';

// WEB03 (BR 13, D10): authentication requests never invoke the global
// 401/403 handler (e.g. a wrong current password must not end the session).
const authRequest = { skipAuthFailureHandler: true };

export const authApi = {
  register(fields) {
    return apiClient.post('/users/register', {
      ...authRequest,
      body: fields,
    });
  },
  login({ email, password }) {
    return apiClient.post('/auth/login', {
      ...authRequest,
      body: { email, password },
      credentials: 'include',
    });
  },
  requestPasswordRecovery(email) {
    return apiClient.post('/auth/password-recovery', {
      ...authRequest,
      body: { email },
    });
  },
  completePasswordRecovery(linkToken, newPassword) {
    return apiClient.post('/auth/password-recovery/complete', {
      ...authRequest,
      body: { linkToken, newPassword },
    });
  },
  changePassword(accessToken, currentPassword, newPassword) {
    return apiClient.patch('/auth/password', {
      ...authRequest,
      body: { currentPassword, newPassword },
      accessToken,
      credentials: 'include',
    });
  },
};