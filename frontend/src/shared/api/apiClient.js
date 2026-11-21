import { getAppConfig } from '../config/appConfig.js';
import { ApiError } from './ApiError.js';

// WEB03 (BR 13, D10): reaction to 401/403 answered by business requests.
// Registered by AuthProvider; authentication requests opt out with
// skipAuthFailureHandler so that an /auth/me answer never re-enters it.
let authFailureHandler = null;

/** WEB03: registers the 401/403 reaction; returns a function that removes it. */
export function setAuthFailureHandler(handler) {
  authFailureHandler = typeof handler === 'function' ? handler : null;
  return () => {
    if (authFailureHandler === handler) authFailureHandler = null;
  };
}

async function request(method, path, options = {}) {
  const { skipAuthFailureHandler = false, ...sendOptions } = options;
  try {
    return await send(method, path, sendOptions);
  } catch (error) {
    if (
      !skipAuthFailureHandler &&
      authFailureHandler &&
      error instanceof ApiError &&
      error.kind === 'http' &&
      (error.status === 401 || error.status === 403)
    ) {
      try {
        // Awaited BEFORE the page sees the error (WEB04: never shown as done).
        await authFailureHandler(error.status, {
          accessToken: sendOptions.accessToken ?? null,
        });
      } catch {
        // The reaction must never replace the original API error.
      }
    }
    // The failed request is never retried automatically.
    throw error;
  }
}

async function send(
  method,
  path,
  {
    body,
    query,
    signal,
    accessToken,
    csrfToken,
    credentials = 'omit',
    headers: extraHeaders,
    responseType = 'json',
  } = {},
) {
  const { apiBaseUrl, apiTimeoutMs } = getAppConfig();
  // Keep credentials within the configured API even when an adapter encodes
  // resource identifiers into a request path.
  if (
    !/^\/(?!\/)[^?#\\\s]+$/.test(path) ||
    path.split('/').some((segment) => /^(?:\.|%2e){1,2}$/i.test(segment))
  ) {
    throw new TypeError('Expected an API path relative to /api/v1.');
  }

  const search = new URLSearchParams(query).toString();
  const url = `${apiBaseUrl}${path}${search ? `?${search}` : ''}`;
  const download = responseType === 'blob';
  const headers = {
    ...extraHeaders,
    Accept: download ? 'application/octet-stream' : 'application/json',
  };
  const binaryBody = typeof Blob !== 'undefined' && body instanceof Blob;
  if (body !== undefined)
    headers['Content-Type'] = binaryBody
      ? 'application/octet-stream'
      : 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    cancel();
  }, apiTimeoutMs);

  try {
    if (controller.signal.aborted)
      throw new ApiError(0, 'Request cancelled.', 'aborted');
    const response = await fetch(url, {
      method,
      headers,
      body: binaryBody ? body : JSON.stringify(body),
      credentials,
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status === 204 && response.ok) return null;
    if (download && response.ok) return await response.blob();

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      if (response.ok)
        throw new ApiError(
          response.status,
          'Unexpected response from the server.',
          'invalid-response',
        );
    }

    if (!response.ok) {
      const message = payload?.error?.message;
      const isClientError = response.status < 500;
      const error = new ApiError(
        response.status,
        isClientError && typeof message === 'string' && message.trim()
          ? message
          : `Request failed with status ${response.status}`,
        'http',
        // WEB06 (ALN-2): validation issues only from a 4xx body.
        isClientError ? payload?.error?.details : undefined,
      );
      if (isClientError && typeof payload?.error?.code === 'string') error.code = payload.error.code;
      throw error;
    }
    return payload;
  } catch (error) {
    if (timedOut)
      throw new ApiError(0, 'The server took too long to answer.', 'timeout');
    if (controller.signal.aborted)
      throw new ApiError(0, 'Request cancelled.', 'aborted');
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'The server could not be reached.', 'network');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

export const apiClient = Object.freeze({
  request,
  get: (path, options) => request('GET', path, options),
  post: (path, options) => request('POST', path, options),
  put: (path, options) => request('PUT', path, options),
  patch: (path, options) => request('PATCH', path, options),
  delete: (path, options) => request('DELETE', path, options),
});
