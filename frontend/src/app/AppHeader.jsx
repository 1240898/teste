import { useLayoutEffect, useRef } from 'react';
import { Link, matchPath, useNavigate } from 'react-router';
import { useAuth } from '../features/authentication/state/authContext.js';
import { SIGNED_OUT_MESSAGE } from '../features/authentication/session.js';
import { useLocale } from '../shared/locale/localeContext.js';
import { LogoutIcon, UserIcon } from './icons.jsx';

function LanguageSelector() {
  const { locale, changeLocale, saveFailed, t } = useLocale();
  return (
    <div
      className="language-preference"
      role="group"
      aria-label={t('language')}
    >
      <button
        className={`language-option${locale === 'pt-PT' ? ' language-option--active' : ''}`}
        type="button"
        lang="pt-PT"
        aria-label="Português"
        aria-pressed={locale === 'pt-PT'}
        data-language-choice="pt-PT"
        onClick={() => changeLocale('pt-PT')}
      >
        PT
      </button>
      <span className="language-separator" aria-hidden="true">
        |
      </span>
      <button
        className={`language-option${locale === 'en-GB' ? ' language-option--active' : ''}`}
        type="button"
        lang="en-GB"
        aria-label="English"
        aria-pressed={locale === 'en-GB'}
        data-language-choice="en-GB"
        onClick={() => changeLocale('en-GB')}
      >
        EN
      </button>
      {saveFailed && (
        <p className="locale-notice" role="status">
          {t('localeNotSaved')}
        </p>
      )}
    </div>
  );
}

function currentFor(item, view) {
  if (view?.currentSectionId !== item.id) return undefined;
  return matchPath(item.path, view.pathname) ? 'page' : 'location';
}

/** Top-right corner: account and logout when signed in, sign-in links otherwise. */
function SessionActions({ items, view }) {
  const auth = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const account = items.find(({ id }) => id === 'account');
  const registration = items.find(({ id }) => id === 'registration');

  async function logout() {
    if (await auth.logout(SIGNED_OUT_MESSAGE)) navigate('/', { replace: true });
  }

  if (auth.status === 'authenticated')
    return (
      <div className="session-actions">
        {account && (
          <Link
            className="header-account"
            data-section-link={account.id}
            to={account.path}
            title={t(account.labelKey)}
            aria-current={currentFor(account, view)}
          >
            <UserIcon />
            <span className="header-account__name">{auth.user.name}</span>
          </Link>
        )}
        <button
          className="icon-button"
          type="button"
          onClick={logout}
          aria-label={t('logout')}
          title={t('logout')}
        >
          <LogoutIcon />
        </button>
      </div>
    );

  if (auth.status !== 'guest') return null;
  return (
    <div className="session-actions">
      <Link className="header-link" to="/login">
        {t('signIn')}
      </Link>
      {registration && (
        <Link
          className="header-link header-link--primary"
          data-section-link={registration.id}
          to={registration.path}
          aria-current={currentFor(registration, view)}
        >
          {t(registration.labelKey)}
        </Link>
      )}
    </div>
  );
}

export default function AppHeader({ items, view }) {
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const styles = document.documentElement.style;
    const measure = () =>
      styles.setProperty('--header-height', `${header.offsetHeight}px`);
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(header);
    return () => {
      observer?.disconnect();
      styles.removeProperty('--header-height');
    };
  }, []);

  return (
    <header className="app-header" ref={headerRef}>
      <Link
        className="brand"
        to="/"
        state={{ returnToStart: true }}
        aria-label="LaPrizza"
      >
        <img
          src="/laprizza-logo.webp"
          alt="LaPrizza"
          width={1312}
          height={1199}
        />
        <span aria-hidden="true">LaPrizza</span>
      </Link>
      <div className="header-actions">
        <LanguageSelector />
        <SessionActions items={items} view={view} />
      </div>
    </header>
  );
}
