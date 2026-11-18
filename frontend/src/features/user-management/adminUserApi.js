import { apiClient } from '../../shared/api/apiClient.js';

export const adminUserApi = {
  list: (token, { signal } = {}) =>
    apiClient.get('/users', {
      accessToken: token,
      query: { includeInactive: 'true' },
      signal,
    }),
  get: (token, id) =>
    apiClient.get(`/users/${encodeURIComponent(id)}`, {
      accessToken: token,
    }),
  updateRoles: (token, id, roles) =>
    apiClient.patch(`/users/${encodeURIComponent(id)}/roles`, {
      accessToken: token,
      body: { roles },
    }),
  deactivate: (token, id) =>
    apiClient.delete(`/users/${encodeURIComponent(id)}`, {
      accessToken: token,
    }),
  reactivate: (token, id) =>
    apiClient.patch(`/users/${encodeURIComponent(id)}/activation`, {
      accessToken: token,
      body: { active: true },
    }),
  invite: (token, id, activationMethod) =>
    apiClient.post(`/users/${encodeURIComponent(id)}/activation-invitations`, {
      accessToken: token,
      body: activationMethod ? { activationMethod } : {},
    }),
  inviteWorker: (token, worker) =>
    apiClient.post('/users/invitations', {
      accessToken: token,
      body: worker,
    }),
};
