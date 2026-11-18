import * as defaultApi from '../services/session/authApi.js';

export const UNCONFIRMED_MESSAGE =
  'We could not confirm your permissions. Please sign in again.';

export const guestSession = Object.freeze({
  status: 'guest',
  token: null,
  user: null,
  message: null,
  csrfToken: null,
  idleTimeoutSeconds: null,
  activityReportIntervalSeconds: null,
  idleExpiresAt: null,
});

/**
 * AA03: resolves the session from the back end only (GET /auth/me).
 * Fail closed: any error or malformed answer returns a session without user
 * and without token.
 */
export async function loadCurrentSession(token, api = defaultApi) {
  if (!token) return guestSession;
  try {
    const user = await api.getCurrentUser(token);
    return { status: 'authenticated', token, user, message: null };
  } catch (error) {
    if (error?.status === 403)
      return { ...guestSession, status: 'denied', message: error.message };
    return { ...guestSession, message: UNCONFIRMED_MESSAGE };
  }
}

/**
 * AA03 (BR 13): called ONLY with the 200 answer of a sign-in, Google (AA02)
 * or local (AA01). The roles in that answer are ignored: the session is built
 * from GET /auth/me.
 */
export function startSession(authToken, api = defaultApi) {
  return loadCurrentSession(authToken?.accessToken, api).then((session) =>
    authToken?.csrfToken
      ? {
          ...session,
          csrfToken: authToken.csrfToken,
          idleTimeoutSeconds: authToken.idleTimeoutSeconds,
          activityReportIntervalSeconds:
            authToken.activityReportIntervalSeconds,
          idleExpiresAt: authToken.idleExpiresAt,
          hasLocalCredential: authToken.hasLocalCredential === true,
        }
      : session,
  );
}

/** A user with several roles receives the union of their permissions. */
export function hasAnyRole(session, requiredRoles) {
  if (session?.status !== 'authenticated' || !session.user) return false;
  if (!requiredRoles?.length) return true;
  return requiredRoles.some((role) => session.user.roles.includes(role));
}
