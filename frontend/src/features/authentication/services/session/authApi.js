import { apiClient } from '../../../../shared/api/apiClient.js';
import { ApiError as AuthApiError } from '../../../../shared/api/ApiError.js';

export { AuthApiError };

// AA03: website roles (Table 1). Guest is not a role.
export const KNOWN_ROLES = Object.freeze([
  'ADMINISTRATOR',
  'MANAGER',
  'EMPLOYEE',
  'CUSTOMER',
]);

const SESSION_OPERATION_LOCK = 'laprizza-auth-session-operation';

// WEB03 (BR 13, D10): authentication requests never invoke the global
// 401/403 handler; AuthProvider maps their answers directly.
const authRequest = { skipAuthFailureHandler: true };

export function hasCrossTabSessionLock() {
  return typeof globalThis.navigator?.locks?.request === 'function';
}

/** Serialize cookie/CSRF rotation and logout across tabs in the same origin. */
export function withSessionOperationLock(operation) {
  const locks = globalThis.navigator?.locks;
  if (typeof locks?.request !== 'function') return operation();
  return locks.request(
    SESSION_OPERATION_LOCK,
    { mode: 'exclusive' },
    operation,
  );
}

export function renewSession(csrfToken) {
  return apiClient.post('/auth/renew', {
    ...authRequest,
    csrfToken,
    credentials: 'include',
  });
}

export function resumeSession() {
  return apiClient.post('/auth/resume', {
    ...authRequest,
    credentials: 'include',
  });
}

export function logoutSession(csrfToken) {
  return apiClient.post('/auth/logout', {
    ...authRequest,
    csrfToken,
    credentials: 'include',
  });
}

/** AA02: asks the back end for the Google authorization URL and state. */
export function startGoogleLogin() {
  return apiClient.post('/auth/google/authorization', {
    ...authRequest,
    body: {},
  });
}

/** AA02: sends the Google code and state; returns the LaPrizza AuthTokenDTO. */
export function completeGoogleLogin(code, state) {
  return apiClient.post('/auth/google/callback', {
    ...authRequest,
    body: { code, state },
    credentials: 'include',
  });
}

/**
 * AA03 (D10): accepts the /auth/me body only if it is well formed.
 * Anything else throws, so the caller keeps protected functionality hidden.
 */
export function parseCurrentUser(body) {
  const fail = () => {
    throw new AuthApiError(
      200,
      'Invalid current user data',
      'invalid-response',
    );
  };
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail();
  const { id, name, email, roles, active } = body;
  if (typeof id !== 'string' || !/^USR-\d{5,}$/.test(id)) fail();
  if (typeof name !== 'string' || !name.trim()) fail();
  if (typeof email !== 'string' || !email.includes('@')) fail();
  if (
    !Array.isArray(roles) ||
    roles.length === 0 ||
    roles.some((role) => !KNOWN_ROLES.includes(role)) ||
    new Set(roles).size !== roles.length
  )
    fail();
    if (active !== true) fail();
  return Object.freeze({
    id,
    name,
    email,
    roles: Object.freeze([...roles]),
    // GDP01: shown and changed in "My data"; anything but true means no consent.
    marketingConsent: body.marketingConsent === true,
  });
}

/** AA03: current internal roles, always obtained from the back end. */
export async function getCurrentUser(token) {
  if (typeof token !== 'string' || !token)
    throw new AuthApiError(401, 'No token provided');
  const body = await apiClient.get('/auth/me', {
    ...authRequest,
    accessToken: token,
  });
  return parseCurrentUser(body);
}