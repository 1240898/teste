import { lazy, Suspense, useCallback, useState } from 'react';
import { apiClient } from '../shared/api/apiClient.js';
import { useAuth } from '../features/authentication/state/authContext.js';
import ProtectedRoute from '../features/authentication/components/ProtectedRoute.jsx';
import ModuleErrorBoundary from './ModuleErrorBoundary.jsx';
import RouteView from './RouteView.jsx';
import { useLocale } from '../shared/locale/localeContext.js';

function LazyModule({ load, request, onView, id, titleKey }) {
  const { t } = useLocale();
  const [{ Page, attempt }, setModule] = useState(() => ({
    Page: lazy(load),
    attempt: 0,
  }));
  function retry() {
    setModule(({ attempt: previous }) => ({
      Page: lazy(load),
      attempt: previous + 1,
    }));
  }
  return (
    <ModuleErrorBoundary
      key={attempt}
      onRetry={retry}
      renderFailure={(onRetry) => (
        <RouteView
          onView={onView}
          kind="moduleError"
          titleKey={titleKey}
          currentSectionId={id}
        >
          <section>
            <h1>{t(titleKey)}</h1>
            <p className="feedback feedback--error" role="alert">
              {t('moduleLoadFailed')}
            </p>
            <button
              className="button button--secondary"
              type="button"
              onClick={onRetry}
            >
              {t('retry')}
            </button>
          </section>
        </RouteView>
      )}
    >
      <Suspense
        fallback={
          <RouteView
            onView={onView}
            kind="pending"
            titleKey="loadingSection"
            ready={false}
          >
            <p className="feedback" role="status">
              {t('loadingSection')}
            </p>
          </RouteView>
        }
      >
        <RouteView
          onView={onView}
          kind="section"
          titleKey={titleKey}
          currentSectionId={id}
        >
          <Page request={request} />
        </RouteView>
      </Suspense>
    </ModuleErrorBoundary>
  );
}

export default function ModulePage({ section, load, onView }) {
  const { token } = useAuth();
  const { id, labelKey: titleKey } = section;

  // WEB03 (D10): business requests of the module. A 401/403 is handled by the
  // global apiClient handler registered by AuthProvider (BR 13): the page
  // only receives the error, after the session and the menu were updated.
  const request = useCallback(
    (method, path, options) =>
      apiClient.request(method, path, {
        body: options?.body,
        query: options?.query,
        signal: options?.signal,
        accessToken: token,
      }),
    [token],
  );

  // ProtectedRoute re-confirms the roles (GET /auth/me) before mounting it.
  return (
    <ProtectedRoute section={section} onView={onView}>
      <LazyModule
        load={load}
        request={request}
        onView={onView}
        id={id}
        titleKey={titleKey}
      />
    </ProtectedRoute>
  );
}