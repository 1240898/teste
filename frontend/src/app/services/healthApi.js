import { apiClient } from '../../shared/api/apiClient.js';

export function getHealth(signal) {
  return apiClient.get('/health', { signal });
}
