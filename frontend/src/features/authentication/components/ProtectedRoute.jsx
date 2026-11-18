import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../state/authContext.js';
import AccessDeniedPage from './AccessDeniedPage.jsx';
import RouteView from '../../../app/RouteView.jsx';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { AccessDecision, evaluateAccess } from '../../../app/navigation/accessPolicy.js';
import {
  SectionAccess,
  isSafeReturnPath,
} from '../../../app/navigation/navigationPolicy.js';

function Pending({ onView }) {
  const { t } = useLocale();
  const pending = (
    <p className="feedback" role="status">
      {t('checkingPermissions')}
    </p>
  );
  return onView ? (
    <RouteView
      onView={onView}
      kind="pending"
      titleKey="checkingPermissions"
      ready={false}
    >
      {pending}
    </RouteView>
  ) : (
    pending
  );
}

function Denied({ onView, children }) {
  return onView ? (
    <RouteView onView={onView} kind="denied" titleKey="accessDenied">
      {children}
    </RouteView>
  ) : (
    children
  );
}

/** Ad-hoc section for callers that only know a list of roles. */
function sectionForRoles(requiredRoles) {
  return { access: SectionAccess.PROTECTED, roles: requiredRoles };
}

/**
 * AA03, extended by WEB03 (SD 2): decides access for a section requested by
 * menu, typed URL, bookmark, history or link. The page (children) is mounted
 * ONLY on ALLOW and only after the roles were re-read from GET /auth/me for
 * this path (D3, D4), so no protected request is ever sent otherwise.
 */
function ProtectedRoute({ section, requiredRoles = [], onView, children }) {
  const auth = useAuth();
  const { pathname } = useLocation();
  const target = section ?? sectionForRoles(requiredRoles);
  const decision = evaluateAccess(target, auth);
  const { status, token, refresh } = auth;
  const confirmationKey = `${pathname}|${token ?? ''}`;
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    if (status !== 'authenticated' || !token) return undefined;
    let active = true;
    // Single-flight in AuthProvider: StrictMode / concurrent callers share it.
    void refresh(token).then(() => {
      if (active) setConfirmed(`${pathname}|${token}`);
    });
    return () => {
      active = false;
    };
    // Re-confirm on every navigation to a protected section (D4).
  }, [pathname, refresh, status, token]);

  if (decision === AccessDecision.PENDING) return <Pending onView={onView} />;

  if (decision === AccessDecision.LOGIN_REQUIRED) {
    // returnTo carries ONLY the path: no query, no token, no data (AA04 AC 6).
    const to = isSafeReturnPath(pathname)
      ? `/login?returnTo=${encodeURIComponent(pathname)}`
      : '/login';
    return <Navigate to={to} replace />;
  }

  if (decision === AccessDecision.ACCOUNT_DENIED)
    return (
      <Denied onView={onView}>
        <AccessDeniedPage message={auth.message} />
      </Denied>
    );

  if (decision === AccessDecision.FORBIDDEN)
    // Generic text: no section data, no required roles, no user roles (AC 3).
    return (
      <Denied onView={onView}>
        <AccessDeniedPage messageKey="insufficientPermission" />
      </Denied>
    );

  if (decision === AccessDecision.REDIRECT_HOME)
    return <Navigate to="/" replace />;

  if (
    target.access === SectionAccess.PROTECTED &&
    confirmed !== confirmationKey
  )
    return <Pending onView={onView} />;

  return children;
}

export default ProtectedRoute;