import { getActive } from '../kitchenViewerApi.js';
import { parseActiveConfiguration } from './activeConfigurationParser.js';

function requestState(error, signal) {
  if (
    signal?.aborted ||
    error?.kind === 'aborted' ||
    error?.name === 'AbortError'
  )
    return { status: 'cancelled' };
  if (error?.status === 401) return { status: 'expired' };
  if (error?.status === 403) return { status: 'denied' };
  if (
    error?.status === 404 &&
    Array.isArray(error.details) &&
    error.details.some((issue) => issue?.code === 'NO_ACTIVE_CONFIGURATION')
  ) {
    return { status: 'empty' };
  }
  return { status: 'error', reason: 'request' };
}

export async function loadActiveKitchen(request, signal) {
  if (signal?.aborted) return { status: 'cancelled' };
  let body;
  try {
    body = await getActive(request, signal);
  } catch (error) {
    return requestState(error, signal);
  }
  if (signal?.aborted) return { status: 'cancelled' };
  try {
    return {
      status: 'loading-assets',
      configuration: parseActiveConfiguration(body),
    };
  } catch {
    return { status: 'invalid' };
  }
}
