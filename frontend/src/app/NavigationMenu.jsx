import { Link, matchPath } from 'react-router';
import { useLocale } from '../shared/locale/localeContext.js';
import { HomeIcon } from './icons.jsx';

/**
 * WEB02 / WEB03: side menu with Start and the sections allowed for the current
 * roles. It stays mounted while the chosen section opens in the main area.
 */
export default function NavigationMenu({ items, view }) {
  const { t } = useLocale();
  return (
    <nav className="primary-navigation" aria-label={t('primaryNavigation')}>
      <ul>
        <li>
          <Link
            className="navigation-link"
            to="/"
            state={{ returnToStart: true }}
            aria-current={view?.kind === 'start' ? 'page' : undefined}
          >
            <HomeIcon />
            <span>{t('start')}</span>
          </Link>
        </li>
        {items.map(({ id, path, labelKey }) => (
          <li key={id}>
            <Link
              className="navigation-link"
              data-section-link={id}
              to={path}
              aria-current={
                view?.currentSectionId === id
                  ? matchPath(path, view.pathname)
                    ? 'page'
                    : 'location'
                  : undefined
              }
            >
              <span>{t(labelKey)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
