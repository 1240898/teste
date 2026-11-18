import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { handleGoogleRedirect } from '../services/session/googleSignIn.js';
import ActivationSignInAction from '../components/ActivationSignInAction.jsx';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { messageKey } from '../../../shared/locale/messageKeys.js';

/** AA02: page for the Google redirect URI (/auth/callback/google). */
function GoogleCallbackPage({ onSignedIn, onDone }) {
  const { t } = useLocale();
  const [error, setError] = useState(null);
  const [activated, setActivated] = useState(false);
  const handled = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // The code and state are single use: never send them twice (StrictMode).
    if (handled.current) return;
    handled.current = true;
    const query = new URLSearchParams(location.search);
    // Remove code and state from the address bar and history.
    if (location.search) navigate(location.pathname, { replace: true });
    handleGoogleRedirect(query)
      .then((result) => {
        if (result.status === 'signed-in') onSignedIn(result.session);
        else if (result.status === 'activated') setActivated(true);
        else if (result.status === 'activation-error') setError(result.key);
        else setError(messageKey(result.message, 'googleFailed'));
      })
      .catch(() => {
        setError('googleFailed');
      });
  }, [location.pathname, location.search, navigate, onSignedIn]);

  return (
    <section className="auth-card">
      <h1>
        {t(
          activated
            ? 'activationTitle'
            : error
              ? 'signInTitle'
              : 'googleCallback',
        )}
      </h1>
      {activated && <p role="status">{t('activationCompleteGoogle')}</p>}
      {error && (
        <p className="feedback feedback--error" role="alert">
          {t(error)}
        </p>
      )}
      {activated ? (
        <ActivationSignInAction />
      ) : (
        <button
          className="button button--secondary"
          type="button"
          onClick={onDone}
        >
          {t('backToSignIn')}
        </button>
      )}
    </section>
  );
}

export default GoogleCallbackPage;
