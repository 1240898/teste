import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import { useState } from 'react';
import { authApi } from '../services/authApi.js';
import FormFeedback, { FieldError, FieldLabel } from '../../../shared/feedback/FormFeedback.jsx';
import ConfirmationDialog from '../../../shared/feedback/ConfirmationDialog.jsx';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { apiMessageKey } from '../../../shared/locale/messageKeys.js';

export default function ChangePasswordPage({
  accessToken,
  onBack,
  onPasswordChanged,
}) {
  const { t } = useLocale();
  const { validate, clearErrors, fieldProps, errors } = useFormValidation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (busy || confirmationOpen) return;
    setMessage('');
    setError('');
    const mismatch =
      newPassword !== confirmation ? 'confirm-password' : undefined;
    if (!validate(event.currentTarget, mismatch)) return;

    setConfirmationOpen(true);
  }

  async function confirmChange() {
    if (busy) return;
    setConfirmationOpen(false);
    setBusy(true);
    try {
      await authApi.changePassword(accessToken, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      if (onPasswordChanged) onPasswordChanged();
      else setMessage('passwordChanged');
    } catch (requestError) {
      setError(apiMessageKey(requestError, 'passwordChangeFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="change-password-title">
      <p className="eyebrow">LaPrizza</p>
      <h1 id="change-password-title">{t('changePassword')}</h1>
      <p className="intro">
        {t('changePasswordIntro', { rules: t('passwordRules') })}
      </p>
      <form noValidate onSubmit={submit} onInput={clearErrors}>
        <FieldLabel id="current-password" label="currentPassword" />
        <input
          {...fieldProps('current-password')}
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
        <FieldError id="current-password" issue={errors['current-password']} />
        <FieldLabel id="new-password" label="newPassword" />
        <input
          {...fieldProps('new-password')}
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
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
        <FieldError id="confirm-password" issue={errors['confirm-password']} />
        <FormFeedback message={message} error={error} />
        <div className="form-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onBack}
          >
            {t('backToAccount')}
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={busy}
          >
            {t(busy ? 'wait' : 'changePassword')}
          </button>
        </div>
      </form>
      <ConfirmationDialog
        open={confirmationOpen}
        consequenceKey="confirmPasswordChangeWarning"
        confirmLabelKey="confirm"
        onCancel={() => setConfirmationOpen(false)}
        onConfirm={() => void confirmChange()}
      />
    </section>
  );
}
