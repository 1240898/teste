import { useState } from 'react';
import { Link } from 'react-router';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import { authApi } from '../services/authApi.js';
import {
  FieldError,
  FieldLabel,
} from '../../../shared/feedback/FormFeedback.jsx';
import FormFeedback from '../../../shared/feedback/FormFeedback.jsx';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { apiMessageKey } from '../../../shared/locale/messageKeys.js';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import LoginDoodles from '../components/LoginDoodles.jsx';

export default function LoginPage({
  onAuthenticated,
  onRequestRecovery,
  statusMessage,
}) {
  const { t } = useLocale();

  return (
    <div className="login-kiosk-stage">
      <LoginDoodles />
      <section className="login-kiosk" aria-labelledby="sign-in-title">
        <div className="login-kiosk__awning" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="login-kiosk__frame">
          <div className="login-kiosk__screen">
            <img
              className="login-kiosk__logo"
              src="/laprizza-logo.webp"
              alt=""
              width="92"
              height="92"
            />
            <h1 id="sign-in-title">{t('signInTitle')}</h1>
            <p className="login-kiosk__intro">{t('signInIntro')}</p>
            {statusMessage && (
              <p className="feedback login-kiosk__status" role="status">
                {t(statusMessage)}
              </p>
            )}
            <LocalSignInForm
              onAuthenticated={onAuthenticated}
              onRequestRecovery={onRequestRecovery}
            />
            <div className="login-kiosk__divider" aria-hidden="true">
              <span />
              <span>{t('or')}</span>
              <span />
            </div>
            <GoogleSignInButton />
            <p className="login-kiosk__google-hint">{t('googleHint')}</p>
            <p className="login-kiosk__register">
              {t('noAccount')}{' '}
              <Link to="/register">{t('createAccount')}</Link>
            </p>
          </div>
        </div>
        <div className="login-kiosk__base" aria-hidden="true">
          <svg viewBox="0 0 32 32" focusable="false">
            <path d="M5 24 11 7c.5-1.4 2-2 3.4-1.4l13.3 6.3L5 24Z" />
            <path d="m8.6 13.3 15.9 7.5M14 10.7l-1.2 2.5m5.5.2-1.2 2.5m5.5.1-1.2 2.5" />
          </svg>
        </div>
      </section>
    </div>
  );
}

export function LocalSignInForm({ onAuthenticated, onRequestRecovery }) {
  const { t } = useLocale();
  const { validate, clearErrors, fieldProps, errors } = useFormValidation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!validate(event.currentTarget)) return;
    setBusy(true);
    try {
      const result = await authApi.login({ email, password });
      onAuthenticated(result);
    } catch (requestError) {
      setError(
        apiMessageKey(
          requestError,
          requestError?.status === 401
            ? 'invalidCredentials'
            : 'unknownMessage',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="login-kiosk__form"
      noValidate
      onSubmit={submit}
      onInput={clearErrors}
    >
      <div className="login-kiosk__field">
        <div className="login-kiosk__label-row">
          <span className="login-kiosk__field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m4 7 8 6 8-6" />
            </svg>
          </span>
          <FieldLabel id="login-email" label="email" />
        </div>
        <input
          {...fieldProps('login-email')}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <FieldError id="login-email" issue={errors['login-email']} />
      </div>

      <div className="login-kiosk__field">
        <div className="login-kiosk__label-row">
          <span className="login-kiosk__field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
            </svg>
          </span>
          <FieldLabel id="login-password" label="password" />
        </div>
        <div className="login-kiosk__password-input">
          <input
            {...fieldProps('login-password')}
            type={passwordVisible ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            className="login-kiosk__visibility"
            type="button"
            aria-label={t(passwordVisible ? 'hidePassword' : 'showPassword')}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
              <circle cx="12" cy="12" r="2.5" />
              {passwordVisible && <path d="m4 4 16 16" />}
            </svg>
          </button>
        </div>
        <FieldError id="login-password" issue={errors['login-password']} />
      </div>

      <div className="login-kiosk__recovery">
        <button type="button" onClick={onRequestRecovery}>
          {t('forgotPassword')}
        </button>
      </div>
      <FormFeedback error={error} />
      <button
        className="login-kiosk__submit"
        type="submit"
        disabled={busy}
      >
        {t(busy ? 'signingIn' : 'signIn')}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
