import { SectionAccess } from './navigationPolicy.js';

// WEB03 (section 3.2): outcome of a request for a section, whatever its origin
// (menu, typed URL, bookmark, history or link). Pure function: no React, no HTTP.
export const AccessDecision = Object.freeze({
  ALLOW: 'ALLOW',
  PENDING: 'PENDING',
  LOGIN_REQUIRED: 'LOGIN_REQUIRED',
  REDIRECT_HOME: 'REDIRECT_HOME',
  ACCOUNT_DENIED: 'ACCOUNT_DENIED',
  FORBIDDEN: 'FORBIDDEN',
});

/**
 * @param section a NavigationSection (navigationPolicy)
 * @param auth    { status, hasAnyRole(...roles) } from AuthProvider
 */
export function evaluateAccess(section, auth) {
  const status = auth?.status;
  if (section.access === SectionAccess.PUBLIC) return AccessDecision.ALLOW;

  if (section.access === SectionAccess.GUEST_ONLY) {
    if (status === 'loading') return AccessDecision.PENDING;
    return status === 'guest'
      ? AccessDecision.ALLOW
      : AccessDecision.REDIRECT_HOME;
  }

  // Protected: fail closed until the roles are confirmed (BR 3).
  if (status === 'loading') return AccessDecision.PENDING;
  if (status === 'denied') return AccessDecision.ACCOUNT_DENIED;
  if (status !== 'authenticated') return AccessDecision.LOGIN_REQUIRED;
  return typeof auth.hasAnyRole === 'function' &&
    auth.hasAnyRole(...section.roles)
    ? AccessDecision.ALLOW
    : AccessDecision.FORBIDDEN;
}