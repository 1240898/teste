import { apiClient } from '../../shared/api/apiClient.js';

export function searchSecurityAuditLogs(token, filters = {}) {
  const query = {};
  for (const key of ['limit', 'offset', 'outcome', 'actorId']) {
    if (filters[key] !== undefined && filters[key] !== '')
      query[key] = String(filters[key]);
  }
  for (const key of ['from', 'to']) {
    if (filters[key]) query[key] = new Date(filters[key]).toISOString();
  }
  return apiClient.get('/security/audit-logs', {
    query,
    accessToken: token,
  });
}
