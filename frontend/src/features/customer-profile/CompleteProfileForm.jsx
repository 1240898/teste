import { useState } from 'react';
import FormFeedback from '../../shared/feedback/FormFeedback.jsx';
import { useFormValidation } from '../../shared/hooks/useFormValidation.js';
import { useLocale } from '../../shared/locale/localeContext.js';
import { apiMessageKey } from '../../shared/locale/messageKeys.js';
import { customerProfileApi } from './customerProfileApi.js';
import PhoneNumberField from './PhoneNumberField.jsx';

/**
 * AA02 clarification / GDP01: an account created by an external provider has no
 * phone number, which the customer record requires. It is asked for before the
 * customer features become available.
 */
export default function CompleteProfileForm({ token, onCompleted }) {
  const { t } = useLocale();
  const { validate, clearErrors, fieldProps, errors } = useFormValidation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!validate(event.currentTarget)) return;
    const phoneNumber = new FormData(event.currentTarget).get('phoneNumber');
    setBusy(true);
    try {
      onCompleted(await customerProfileApi.completeMine(token, phoneNumber));
    } catch (requestError) {
      setError(apiMessageKey(requestError, 'profileCompletionFailed'));
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="complete-profile-title">
      <h1 id="complete-profile-title">{t('completeProfile')}</h1>
      <p className="intro">{t('completeProfileIntro')}</p>
      <form noValidate onSubmit={submit} onInput={clearErrors}>
        <PhoneNumberField
          id="complete-profile-phone"
          fieldProps={fieldProps}
          errors={errors}
        />
        <FormFeedback error={error} />
        <div className="form-actions">
          <button
            className="button button--primary"
            type="submit"
            disabled={busy}
          >
            {t(busy ? 'wait' : 'saveProfile')}
          </button>
        </div>
      </form>
    </section>
  );
}