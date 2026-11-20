import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router';
import GoogleCallbackPage from '../features/authentication/pages/GoogleCallbackPage.jsx';
import SessionPanel from '../features/authentication/components/SessionPanel.jsx';
import AccessDeniedPage from '../features/authentication/components/AccessDeniedPage.jsx';
import { useAuth } from '../features/authentication/state/authContext.js';
import ProtectedRoute from '../features/authentication/components/ProtectedRoute.jsx';
import { SIGNED_OUT_MESSAGE } from '../features/authentication/session.js';
import LoginPage from '../features/authentication/pages/LoginPage.jsx';
import PasswordRecoveryPage from '../features/authentication/pages/PasswordRecoveryPage.jsx';
import ChangePasswordPage from '../features/authentication/pages/ChangePasswordPage.jsx';
import LocalRegistrationPage from '../features/authentication/pages/LocalRegistrationPage.jsx';
import AdminUserManagementPage from '../features/user-management/AdminUserManagementPage.jsx';
import SecurityAuditPage from '../features/security-audit/SecurityAuditPage.jsx';
import CataloguePage from '../features/catalogue/CataloguePage.jsx';
import CatalogueProductPage from '../features/catalogue/CatalogueProductPage.jsx';
import PrivacyNoticePage from '../features/privacy/PrivacyNoticePage.jsx';
import RouteView from './RouteView.jsx';
import { useLocale } from '../shared/locale/localeContext.js';
import { messageKey } from '../shared/locale/messageKeys.js';
import { isSafeReturnPath } from './navigation/navigationPolicy.js';

import {
  accountSection,
  auditSection,
  passwordPath,
  passwordSection,
  registrationSection,
  usersSection,
} from './navigation/routeSections.js';

export function AccountPanel() {
  const auth = useAuth();
  const navigate = useNavigate();
  return (
    <SessionPanel
      session={auth}
      onChangePassword={() => navigate(passwordPath)}
    />
  );
}

export function AccountRoute({ onView, start = false, recovery = false }) {
  const auth = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  // Both the existing e-mail link at / and the dedicated route are supported.
  // Keep its one-time credential in memory after removing it from the URL.
  const [recoveryToken, setRecoveryToken] = useState(() =>
    new URLSearchParams(location.search).get('recoveryToken'),
  );
  const returnToStart = start && location.state?.returnToStart;
  // WEB03 (D6, BR 8): after sign-in go back to the requested section, but only
  // to an internal path of a known section (no open redirect).
  const returnTo = start
    ? null
    : new URLSearchParams(location.search).get('returnTo');
  const activeRecoveryToken = returnToStart ? null : recoveryToken;
  useEffect(() => {
    if (new URLSearchParams(location.search).has('recoveryToken'))
      navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);
  useEffect(() => {
    if (returnToStart) setRecoveryToken(null);
  }, [returnToStart]);

  if (recovery || activeRecoveryToken) {
    return (
      <RouteView
        onView={onView}
        kind="recovery"
        titleKey={activeRecoveryToken ? 'choosePassword' : 'recoverPassword'}
      >
        <PasswordRecoveryPage
          token={activeRecoveryToken}
          onBackToLogin={() => {
            setRecoveryToken(null);
            navigate('/login', { replace: true });
          }}
        />
      </RouteView>
    );
  }
  if (auth.status === 'loading')
    return (
      <RouteView
        onView={onView}
        kind="pending"
        titleKey="checkingPermissions"
        ready={false}
      >
        <p className="feedback" role="status">
          {t('checkingPermissions')}
        </p>
      </RouteView>
    );
  if (auth.status === 'authenticated') {
    // /login once signed in: back to the requested section (if safe) or Start.
    if (!start)
      return (
        <Navigate
          to={returnTo !== null && isSafeReturnPath(returnTo) ? returnTo : '/'}
          replace
        />
      );
    // Start shows available sections; account details and logout live in the
    // header and in the Account section.
    return (
      <RouteView onView={onView} kind="start" titleKey="start">
        <section className="welcome" aria-labelledby="welcome-title">
          <h1 id="welcome-title">
            {t('welcomeName', { name: auth.user.name })}
          </h1>
          <p className="intro">{t('chooseSection')}</p>
        </section>
      </RouteView>
    );
  }
  if (auth.status === 'denied')
    return (
      <RouteView onView={onView} kind="denied" titleKey="accessDenied">
        <AccessDeniedPage
          message={auth.message}
          onBack={() => auth.logout()}
          showStart={!start}
        />
      </RouteView>
    );
  if (auth.status === 'logoutPending') {
    return (
      <RouteView onView={onView} kind="logout" titleKey="logout">
        <section>
          <h1>{t('logout')}</h1>
          <p className="feedback" role="status">
            {t(messageKey(auth.message, 'signingOut'))}
          </p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => auth.logout(SIGNED_OUT_MESSAGE)}
          >
            {t('retryLogout')}
          </button>
        </section>
      </RouteView>
    );
  }
  if (start) return <RouteView onView={onView} kind="start" titleKey="start" />;

  return (
    <RouteView
      onView={onView}
      kind={start ? 'start' : 'login'}
      titleKey={start ? 'start' : 'signInTitle'}
    >
      <LoginPage
        onAuthenticated={auth.acceptAuthToken}
        onRequestRecovery={() => navigate('/password-recovery')}
        statusMessage={
          auth.message
            ? auth.message === SIGNED_OUT_MESSAGE
              ? 'signedOut'
              : messageKey(auth.message)
            : ''
        }
      />
    </RouteView>
  );
}

export function GoogleCallbackRoute() {
  const { acceptAuthToken } = useAuth();
  const navigate = useNavigate();
  const onSignedIn = useCallback(
    (session) => {
      void acceptAuthToken(session);
      navigate('/', { replace: true });
    },
    [acceptAuthToken, navigate],
  );
  return (
    <GoogleCallbackPage
      onSignedIn={onSignedIn}
      onDone={() => navigate('/', { replace: true })}
    />
  );
}

export function RegistrationRoute({ onView }) {
  const navigate = useNavigate();
  // Guest only (WEB03): pending while loading, start page once signed in.
  return (
    <ProtectedRoute section={registrationSection} onView={onView}>
      <RouteView
        onView={onView}
        kind="register"
        titleKey={registrationSection.labelKey}
        currentSectionId={registrationSection.id}
      >
        <LocalRegistrationPage onBackToSignIn={() => navigate('/login')} />
      </RouteView>
    </ProtectedRoute>
  );
}

export function ChangePasswordRoute({ onView }) {
  const auth = useAuth();
  const navigate = useNavigate();
  return (
    <ProtectedRoute section={passwordSection} onView={onView}>
      {auth.hasLocalCredential ? (
        <RouteView
          onView={onView}
          kind="password"
          titleKey="changePassword"
          currentSectionId={accountSection.id}
        >
          <ChangePasswordPage
            accessToken={auth.token}
            onBack={() => navigate(accountSection.path)}
            onPasswordChanged={() => {
              auth.discardSession(
                'Password changed. Sign in again with your new password.',
              );
              navigate('/login', { replace: true });
            }}
          />
        </RouteView>
      ) : (
        <RouteView onView={onView} kind="denied" titleKey="accessDenied">
          <AccessDeniedPage messageKey="noLocalPassword" />
        </RouteView>
      )}
    </ProtectedRoute>
  );
}

export function UserManagementRoute({ onView }) {
  const auth = useAuth();
  return (
    <ProtectedRoute section={usersSection} onView={onView}>
      <RouteView
        onView={onView}
        kind="section"
        titleKey={usersSection.labelKey}
        currentSectionId={usersSection.id}
      >
        <AdminUserManagementPage
          token={auth.token}
          refreshSession={auth.refresh}
        />
      </RouteView>
    </ProtectedRoute>
  );
}

export function SecurityAuditRoute({ onView }) {
  const auth = useAuth();
  const navigate = useNavigate();
  return (
    <ProtectedRoute section={auditSection} onView={onView}>
      <RouteView
        onView={onView}
        kind="section"
        titleKey={auditSection.labelKey}
        currentSectionId={auditSection.id}
      >
        <SecurityAuditPage
          token={auth.token}
          onBack={() => navigate('/')}
        />
      </RouteView>
    </ProtectedRoute>
  );
}

/**
 * WEB03 (BR 4, AC 4): public sections (catalogue, privacy notice). The guard
 * allows every status, Guest included, and never waits for /auth/me.
 */
export function PublicSectionRoute({ section, onView, titleKey, children }) {
  return (
    <ProtectedRoute section={section} onView={onView}>
      <RouteView
        onView={onView}
        kind="section"
        titleKey={titleKey ?? section.labelKey}
        currentSectionId={section.id}
      >
        {children}
      </RouteView>
    </ProtectedRoute>
  );
}
