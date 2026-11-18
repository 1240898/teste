import { useAuth } from '../../features/authentication/state/authContext.js';

/**
 * WEB03: action-level visibility (buttons, links) inside a page, e.g.
 * <RequireRole roles={['MANAGER']}><button>New product</button></RequireRole>.
 * Visibility only: the back end still checks every operation (AC 7).
 */
export default function RequireRole({ roles = [], fallback = null, children }) {
  const auth = useAuth();
  return auth.status === 'authenticated' && auth.hasAnyRole(...roles)
    ? children
    : fallback;
}