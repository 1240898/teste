import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import { useState } from 'react';
import { authApi } from '../services/authApi.js';
import FormFeedback, { FieldError, FieldLabel } from '../../../shared/feedback/FormFeedback.jsx';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { apiMessageKey } from '../../../shared/locale/messageKeys.js';

export default function LocalRegistrationPage({ onBackToSignIn }) {
  const { t } = useLocale();
  const { validate, clearErrors, fieldProps, errors } = useFormValidation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);
  const [invitationDelivery, setInvitationDelivery] = useState('SENT');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!validate(event.currentTarget)) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await authApi.register({
        name: fields.get('name'),
        email: fields.get('email'),
        password: fields.get('password'),
        marketingConsent: fields.has('marketingConsent'),
      });
      setInvitationDelivery(
        result?.invitationDelivery?.deliveryStatus ?? 'SENT',
      );
      setCreated(true);
    } catch (requestError) {
      setError(apiMessageKey(requestError, 'registrationFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="registration-title">
      <h1 id="registration-title">{t('createAccount')}</h1>
      {created ? (
        <>
          <FormFeedback
            message={
              invitationDelivery === 'SENT' ? 'accountCreated' : undefined
            }
            error={
              invitationDelivery === 'SENT'
                ? undefined
                : 'accountCreatedEmailFailed'
            }
          />
          <button
            className="button button--secondary"
            type="button"
            onClick={onBackToSignIn}
          >
            {t('backToSignIn')}
          </button>
        </>
      ) : (
        <form noValidate onSubmit={submit} onInput={clearErrors}>
          <FieldLabel id="registration-name" label="name" />
          <input
            {...fieldProps('registration-name')}
            name="name"
            autoComplete="name"
            maxLength={100}
            required
          />
          <FieldError
            id="registration-name"
            issue={errors['registration-name']}
          />
          <FieldLabel id="registration-email" label="email" />
          <input
            {...fieldProps('registration-email')}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
          <FieldError
            id="registration-email"
            issue={errors['registration-email']}
          />
          <FieldLabel id="registration-password" label="password" />
          <input
            {...fieldProps(
              'registration-password',
              'registration-password-rules',
            )}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
          />
          <p className="field-hint" id="registration-password-rules">
            {t('passwordRules')}
          </p>
          <FieldError
            id="registration-password"
            issue={errors['registration-password']}
          />
          <label className="registration-consent">
            <input type="checkbox" name="marketingConsent" />{' '}
            {t('marketingConsent')}
          </label>
          <FormFeedback error={error} />
          <div className="form-actions">
            <button
              className="button button--secondary"
              type="button"
              onClick={onBackToSignIn}
            >
              {t('backToSignIn')}
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={busy}
            >
              {t(busy ? 'creatingAccount' : 'createAccount')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
