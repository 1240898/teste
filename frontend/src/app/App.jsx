import { useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { getAppConfig } from '../shared/config/appConfig.js';
import { useAuth } from '../features/authentication/state/authContext.js';
import { AuthProvider } from '../features/authentication/state/AuthProvider.jsx';
import ProtectedRoute from '../features/authentication/components/ProtectedRoute.jsx';
import ActivationPage from '../features/authentication/pages/ActivationPage.jsx';
import ModulePage from './ModulePage.jsx';
import CataloguePage from '../features/catalogue/CataloguePage.jsx';
import CatalogueProductPage from '../features/catalogue/CatalogueProductPage.jsx';
import PrivacyNoticePage from '../features/privacy/PrivacyNoticePage.jsx';
import AppLayout from './AppLayout.jsx';
import NotFoundPage from './NotFoundPage.jsx';
import RouteView from './RouteView.jsx';
import StartPage from './StartPage.jsx';
import LocaleProvider from '../shared/locale/LocaleProvider.jsx';
import { useLocale } from '../shared/locale/localeContext.js';
import {
  SECTIONS,
  getVisibleSections,
  isSectionEnabled,
  matchesSection,
} from './navigation/navigationPolicy.js';
import {
  AccountPanel,
  AccountRoute,
  ChangePasswordRoute,
  GoogleCallbackRoute,
  MyDataRoute,
  PublicSectionRoute,
  RegistrationRoute,
  SecurityAuditRoute,
  SharedResourcesRoute,
  UserManagementRoute,
} from './routeComponents.jsx';
import {
  accountSection,
  auditSection,
  catalogueSection,
  myDataSection,
  passwordPath,
  privacySection,
  registrationSection,
  sharedResourcesSection,
  usersSection,
} from './navigation/routeSections.js';

function ConfiguredApp({ modules }) {
  const { t } = useLocale();
  try {
    getAppConfig();
  } catch {
    return (
      <main>
        <h1>LaPrizza</h1>
        <p role="alert">{t('configurationError')}</p>
      </main>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes modules={modules} />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppRoutes({ modules }) {
  const auth = useAuth();
  const { pathname } = useLocation();
  const [view, setView] = useState(null);
  // WEB03 (AC 1, AC 4, AC 5): menu built from the roles confirmed by /auth/me.
  const items = getVisibleSections(auth, { modules });
  const enabledModules = SECTIONS.filter(
    (section) => section.module && isSectionEnabled(section, modules),
  );
  const activeModule = enabledModules.find((section) =>
    matchesSection(section, pathname),
  );
  const resolvedView = view?.pathname === pathname ? view : null;
  const notFound = (
    <RouteView onView={setView} kind="unknown" titleKey="notFound">
      <NotFoundPage />
    </RouteView>
  );
  return (
    <AppLayout
      items={items}
      view={resolvedView}
      isModuleRoute={Boolean(activeModule)}
    >
      <Routes>
        <Route
          path="/"
          element={
            <StartPage items={items}>
              <AccountRoute key="home" onView={setView} start />
            </StartPage>
          }
        />
        <Route
          path="/login"
          element={<AccountRoute key="login" onView={setView} />}
        />
        <Route
          path={registrationSection.path}
          element={<RegistrationRoute onView={setView} />}
        />
        <Route
          path="/password-recovery"
          element={<AccountRoute key="recovery" onView={setView} recovery />}
        />
        <Route
          path="/activate"
          element={
            <RouteView
              onView={setView}
              kind="activation"
              titleKey="activationTitle"
            >
              <ActivationPage />
            </RouteView>
          }
        />
        <Route
          path="/auth/callback/google"
          element={
            <RouteView
              onView={setView}
              kind="callback"
              titleKey="googleCallback"
            >
              <GoogleCallbackRoute />
            </RouteView>
          }
        />
        <Route
          path={accountSection.path}
          element={
            <ProtectedRoute section={accountSection} onView={setView}>
              <RouteView
                onView={setView}
                kind="account"
                titleKey={accountSection.labelKey}
                currentSectionId={accountSection.id}
              >
                <AccountPanel />
              </RouteView>
            </ProtectedRoute>
          }
        />
        <Route
          path={passwordPath}
          element={<ChangePasswordRoute onView={setView} />}
        />
        <Route
          path={usersSection.path}
          element={<UserManagementRoute onView={setView} />}
        />
        <Route
          path={myDataSection.path}
          element={<MyDataRoute onView={setView} />}
        />
        <Route
          path={auditSection.path}
          element={<SecurityAuditRoute onView={setView} />}
        />
        <Route
          path={sharedResourcesSection.path}
          element={<SharedResourcesRoute onView={setView} />}
        />
        <Route
          path={catalogueSection.path}
          element={
            <PublicSectionRoute section={catalogueSection} onView={setView}>
              <CataloguePage />
            </PublicSectionRoute>
          }
        />
        <Route
          path={`${catalogueSection.path}/:productId`}
          element={
            <PublicSectionRoute
              section={catalogueSection}
              onView={setView}
              titleKey="productDetails"
            >
              <CatalogueProductPage />
            </PublicSectionRoute>
          }
        />
        <Route
          path={privacySection.path}
          element={
            <PublicSectionRoute section={privacySection} onView={setView}>
              <PrivacyNoticePage />
            </PublicSectionRoute>
          }
        />
        {enabledModules.map((section) => (
          <Route
            key={section.id}
            path={
              section.childPaths.length ? `${section.path}/*` : section.path
            }
            element={
              activeModule?.id === section.id ? (
                <ModulePage
                  key={section.id}
                  section={section}
                  load={modules[section.id]}
                  onView={setView}
                />
              ) : (
                notFound
              )
            }
          />
        ))}
        <Route path="*" element={notFound} />
      </Routes>
    </AppLayout>
  );
}

export default function App({ modules = {} }) {
  return (
    <LocaleProvider>
      <ConfiguredApp modules={modules} />
    </LocaleProvider>
  );
}
