import { useRef } from 'react';
import { useLocale } from '../shared/locale/localeContext.js';
import { SectionPlacement } from './navigation/navigationPolicy.js';
import AppHeader from './AppHeader.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';
import NavigationMenu from './NavigationMenu.jsx';
import RouteOrientation from './RouteOrientation.jsx';

export default function AppLayout({ items, view, isModuleRoute, children }) {
  const { t } = useLocale();
  const mainRef = useRef(null);
  // WEB03: account / registration go to the top-right corner of the header;
  // every other section allowed for the current roles goes to the side menu,
  // which is only shown when there is at least one such section.
  const headerItems = items.filter(
    ({ placement }) => placement === SectionPlacement.HEADER,
  );
  const menuItems = items.filter(
    ({ placement }) => placement !== SectionPlacement.HEADER,
  );

  function skipToMain(event) {
    event.preventDefault();
    mainRef.current.focus({ preventScroll: true });
    mainRef.current.scrollIntoView?.({ block: 'start' });
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={skipToMain}>
        {t('skipToContent')}
      </a>
      <AppHeader items={headerItems} view={view} />
      <div
        className={menuItems.length ? 'app-body' : 'app-body app-body--full'}
      >
        {menuItems.length > 0 && (
          <div className="app-sidebar">
            <NavigationMenu items={menuItems} view={view} />
          </div>
        )}
        <main
          id="main-content"
          tabIndex={-1}
          ref={mainRef}
          className={isModuleRoute ? 'module-layout' : 'auth-layout'}
        >
          {children}
        </main>
      </div>
      <ConnectionStatus />
      <RouteOrientation view={view} mainRef={mainRef} />
    </div>
  );
}
