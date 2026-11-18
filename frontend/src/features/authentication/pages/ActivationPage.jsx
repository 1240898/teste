import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  activationApi,
  ACTIVATION_PASSWORD_REQUIRED,
} from '../services/activationApi.js';
import { beginGoogleActivation } from '../services/session/googleSignIn.js';
import ActivationSignInAction from '../components/ActivationSignInAction.jsx';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { apiMessageKey } from '../../../shared/locale/messageKeys.js';

function activationError(error, fallback) {
  if (error?.message === 'This invitation can no longer be used.')
    return 'activationUnavailable';
  if (error?.status === 429) return 'activationRateLimited';
  return apiMessageKey(error, fallback);
}

export default function ActivationPage() {
  const { t } = useLocale();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = useState(() =>
    new URLSearchParams(search).get('activationToken'),
  );
  const [method, setMethod] = useState(null);
  const [phase, setPhase] = useState(token ? 'loading' : 'unavailable');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    if (search) navigate('/activate', { replace: true });
  }, [navigate, search]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    activationApi
      .inspect(token, controller.signal)
      .then(({ method: selected }) => {
        if (controller.signal.aborted) return;
        if (selected !== 'LOCAL' && selected !== 'EXTERNAL') {
          setToken(null);
          setPhase('unavailable');
          return;
        }
        setMethod(selected);
        setPhase('confirm');
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setToken(null);
        setError(activationError(cause, 'activationUnavailable'));
        setPhase('unavailable');
      });
    return () => controller.abort();
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const password =
      phase === 'password'
        ? new FormData(event.currentTarget).get('password')
        : undefined;
    try {
      if (method === 'EXTERNAL') {
        await beginGoogleActivation(token);
        setToken(null);
        setPhase('redirecting');
        return;
      }
      await activationApi.local(token, password);
      setToken(null);
      setPhase('activated');
    } catch (cause) {
      if (
        cause?.message === ACTIVATION_PASSWORD_REQUIRED &&
        method === 'LOCAL'
      ) {
        setPhase('password');
      } else {
        const key = activationError(
          cause,
          method === 'EXTERNAL' ? 'activationGoogleFailed' : 'activationFailed',
        );
        setError(key);
        if (key === 'activationUnavailable') {
          setToken(null);
          setPhase('unavailable');
        }
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="activation-title">
      <h1 id="activation-title">{t('activationTitle')}</h1>
      {phase === 'loading' && <p role="status">{t('activationChecking')}</p>}
      {phase === 'redirecting' && <p role="status">{t('wait')}</p>}
      {phase === 'activated' && (
        <p role="status">{t('activationCompleteLocal')}</p>
      )}
      {(error || phase === 'unavailable') && (
        <p className="feedback feedback--error" role="alert">
          {t(error || 'activationUnavailable')}
        </p>
      )}
      {(phase === 'confirm' || phase === 'password') && (
        <form onSubmit={submit}>
          {phase === 'password' && (
            <>
              <label htmlFor="activation-password">
                {t('activationPassword')}
              </label>
              <input
                id="activation-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={72}
                required
                aria-describedby="activation-password-rules"
              />
              <p id="activation-password-rules" className="field-hint">
                {t('passwordRules')}
              </p>
            </>
          )}
          <button
            type="submit"
            className="button button--primary"
            disabled={busy}
          >
            {t(
              busy
                ? 'wait'
                : method === 'EXTERNAL'
                  ? 'activationUseGoogle'
                  : 'activationConfirm',
            )}
          </button>
        </form>
      )}
      {phase === 'activated' && <ActivationSignInAction />}
      {phase === 'unavailable' && (
        <Link className="button button--secondary" to="/login">
          {t('backToSignIn')}
        </Link>
      )}
    </section>
  );
}
