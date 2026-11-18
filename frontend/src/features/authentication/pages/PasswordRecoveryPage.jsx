import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import { useState } from 'react';
import { authApi } from '../services/authApi.js';
import FormFeedback, { FieldError, FieldLabel } from '../../../shared/feedback/FormFeedback.jsx';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { apiMessageKey } from '../../../shared/locale/messageKeys.js';

export default function PasswordRecoveryPage({ token, onBackToLogin }) {
  const { t } = useLocale();
  const { validate, clearErrors, fieldProps, errors } = useFormValidation();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    setError('');
    const mismatch =
      token && newPassword !== confirmation ? 'confirm-password' : undefined;
    if (!validate(event.currentTarget, mismatch)) return;

    setBusy(true);
    try {
      if (token) {
        await authApi.completePasswordRecovery(token, newPassword);
        setMessage('passwordChangedSignIn');
      } else {
        await authApi.requestPasswordRecovery(email);
        setMessage('recoveryRequested');
      }
    } catch (requestError) {
      setError(apiMessageKey(requestError, 'unknownMessage'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="recovery-title">
      <p className="eyebrow">LaPrizza</p>
      <h1 id="recovery-title">
        {t(token ? 'choosePassword' : 'recoverPassword')}
      </h1>
      {!token && <p className="intro">{t('recoveryIntro')}</p>}
      <form noValidate onSubmit={submit} onInput={clearErrors}>
        {token ? (
          <>
            <FieldLabel id="new-password" label="newPassword" />
            <input
              {...fieldProps('new-password', 'new-password-rules')}
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <p className="field-hint" id="new-password-rules">
              {t('passwordRules')}
            </p>
            <FieldError id="new-password" issue={errors['new-password']} />
            <FieldLabel id="confirm-password" label="confirmPassword" />
            <input
              {...fieldProps('confirm-password')}
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
            <FieldError
              id="confirm-password"
              issue={errors['confirm-password']}
            />
          </>
        ) : (
          <>
            <FieldLabel id="recovery-email" label="email" />
            <input
              {...fieldProps('recovery-email')}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <FieldError id="recovery-email" issue={errors['recovery-email']} />
          </>
        )}
        <FormFeedback message={message} error={error} />
        <div className="form-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onBackToLogin}
          >
            {t('backToSignIn')}
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={busy}
          >
            {t(busy ? 'wait' : token ? 'changePassword' : 'sendLink')}
          </button>
        </div>
      </form>
    </section>
  );
}
