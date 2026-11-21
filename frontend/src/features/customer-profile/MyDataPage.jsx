import { useEffect, useRef, useState } from 'react';
import ConfirmationDialog from '../../shared/feedback/ConfirmationDialog.jsx';
import FormFeedback, {
  FieldError,
  FieldLabel,
} from '../../shared/feedback/FormFeedback.jsx';
import LoadingState from '../../shared/feedback/LoadingState.jsx';
import { useFormValidation } from '../../shared/hooks/useFormValidation.js';
import { useLocale } from '../../shared/locale/localeContext.js';
import { apiMessageKey } from '../../shared/locale/messageKeys.js';
import CompleteProfileForm from './CompleteProfileForm.jsx';
import { customerProfileApi } from './customerProfileApi.js';
import PhoneNumberField from './PhoneNumberField.jsx';

/**
 * GDP01 (Sprint 2 Table 1, Customer role): "My data" — the customer's own
 * record, optional allergens with explicit consent and the marketing consent.
 */
export default function MyDataPage({ token, user, refreshSession }) {
  const { t } = useLocale();
  const [loadState, setLoadState] = useState('loading');
  const [profile, setProfile] = useState(null);
  const [allergens, setAllergens] = useState([]);
  // Loaded once: the access token rotates on renewal (AA04) and a reload would
  // discard what the user is editing. Later requests use the current token.
  const initialToken = useRef(token);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoadState('loading');
    Promise.all([
      customerProfileApi
        .getMine(initialToken.current, { signal })
        .catch((error) => {
          if (error?.status === 404) return null;
          throw error;
        }),
      customerProfileApi.listAllergens({ signal }),
    ])
      .then(([mine, catalogue]) => {
        setProfile(mine);
        setAllergens(catalogue);
        setLoadState(mine ? 'ready' : 'missing');
      })
      .catch((error) => {
        if (error?.kind !== 'aborted') setLoadState('error');
      });
    return () => controller.abort();
  }, []);

  if (loadState === 'loading') return <LoadingState labelKey="loadingMyData" />;
  if (loadState === 'error') return <FormFeedback error="myDataLoadFailed" />;
  if (loadState === 'missing')
    return (
      <CompleteProfileForm
        token={token}
        onCompleted={(created) => {
          setProfile(created);
          setLoadState('ready');
        }}
      />
    );

  return (
    <section className="my-data" aria-labelledby="my-data-title">
      <h1 id="my-data-title">{t('myPrivacy')}</h1>
      <p className="intro">{t('myDataIntro')}</p>
      <ContactSection token={token} profile={profile} onSaved={setProfile} />
      <AllergenSection
        token={token}
        profile={profile}
        allergens={allergens}
        onSaved={setProfile}
      />
      <MarketingSection
        token={token}
        given={user.marketingConsent === true}
        refreshSession={refreshSession}
      />
    </section>
  );
}

function ContactSection({ token, profile, onSaved }) {
  const { t } = useLocale();
  const { validate, clearErrors, fieldProps, errors } = useFormValidation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    setError('');
    if (!validate(event.currentTarget)) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    try {
      onSaved(
        await customerProfileApi.updateMine(token, {
          name: fields.get('name'),
          phoneNumber: fields.get('phoneNumber'),
        }),
      );
      setMessage('contactDetailsSaved');
    } catch (requestError) {
      setError(apiMessageKey(requestError, 'contactDetailsFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="contact-title">
      <h2 id="contact-title">{t('contactDetails')}</h2>
      <form noValidate onSubmit={submit} onInput={clearErrors}>
        <FieldLabel id="my-data-name" label="name" />
        <input
          {...fieldProps('my-data-name')}
          name="name"
          autoComplete="name"
          maxLength={100}
          defaultValue={profile.name}
          required
        />
        <FieldError id="my-data-name" issue={errors['my-data-name']} />
        <dl>
          <dt>{t('email')}</dt>
          <dd>{profile.email}</dd>
        </dl>
        <PhoneNumberField
          id="my-data-phone"
          fieldProps={fieldProps}
          errors={errors}
          defaultValue={profile.phoneNumber}
        />
        <FormFeedback message={message} error={error} />
        <div className="form-actions">
          <button
            className="button button--primary"
            type="submit"
            disabled={busy}
          >
            {t(busy ? 'wait' : 'save')}
          </button>
        </div>
      </form>
    </section>
  );
}

const allergenIdsOf = (profile) =>
  new Set(
    profile.dietaryRestrictions
      .filter((x) => x.allergenId !== null)
      .map((x) => x.allergenId),
  );

function AllergenSection({ token, profile, allergens, onSaved }) {
  const { t } = useLocale();
  const hadConsent = profile.healthDataConsent.given;
  const [consent, setConsent] = useState(hadConsent);
  const [selected, setSelected] = useState(() => allergenIdsOf(profile));
  const [busy, setBusy] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // Restrictions recorded by the Manager without an allergen are kept as they are.
  const otherRestrictions = profile.dietaryRestrictions.filter(
    (x) => x.allergenId === null,
  );

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    setError('');
    // Withdrawing consent erases the stored allergens: confirm first.
    if (!consent && hadConsent) setConfirmationOpen(true);
    else void save();
  }

  async function save() {
    setConfirmationOpen(false);
    setBusy(true);
    try {
      const saved = await customerProfileApi.updateAllergens(token, {
        healthDataConsent: consent,
        allergenIds: consent ? [...selected].sort((a, b) => a - b) : [],
      });
      setMessage(consent ? 'allergensSaved' : 'healthConsentWithdrawn');
      setSelected(allergenIdsOf(saved));
      onSaved(saved);
    } catch (requestError) {
      setError(apiMessageKey(requestError, 'allergensFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="allergens-title">
      <h2 id="allergens-title">{t('myAllergens')}</h2>
      <p className="intro">{t('myAllergensIntro')}</p>
      <form noValidate onSubmit={submit}>
        <label className="registration-consent">
          <input
            type="checkbox"
            name="healthDataConsent"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />{' '}
          {t('healthDataConsent')}
        </label>
        <fieldset className="allergen-options" disabled={!consent}>
          <legend>{t('allergens')}</legend>
          {allergens.map((allergen) => (
            <label key={allergen.id} className="registration-consent">
              <input
                type="checkbox"
                name="allergenIds"
                value={allergen.id}
                checked={consent && selected.has(allergen.id)}
                onChange={() => toggle(allergen.id)}
              />{' '}
              {allergen.name}
            </label>
          ))}
        </fieldset>
        {otherRestrictions.length > 0 && (
          <>
            <p className="field-hint">{t('otherRestrictionsHint')}</p>
            <ul>
              {otherRestrictions.map((x) => (
                <li key={x.name}>{x.name}</li>
              ))}
            </ul>
          </>
        )}
        <FormFeedback message={message} error={error} />
        <div className="form-actions">
          <button
            className="button button--primary"
            type="submit"
            disabled={busy}
          >
            {t(busy ? 'wait' : 'save')}
          </button>
        </div>
      </form>
      <ConfirmationDialog
        open={confirmationOpen}
        consequenceKey="withdrawHealthConsentWarning"
        confirmLabelKey="confirm"
        onCancel={() => setConfirmationOpen(false)}
        onConfirm={() => void save()}
      />
    </section>
  );
}

function MarketingSection({ token, given, refreshSession }) {
  const { t } = useLocale();
  const [checked, setChecked] = useState(given);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    setError('');
    setBusy(true);
    try {
      await customerProfileApi.updateMarketingConsent(token, checked);
      setMessage(
        checked ? 'marketingConsentGiven' : 'marketingConsentWithdrawn',
      );
      // The account (GET /auth/me) holds the consent: reload it. A failed
      // reload must not report the (already saved) consent as failed.
      void Promise.resolve(refreshSession?.(token)).catch(() => {});
    } catch (requestError) {
      setError(apiMessageKey(requestError, 'marketingConsentFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="marketing-title">
      <h2 id="marketing-title">{t('marketingCommunications')}</h2>
      <form noValidate onSubmit={submit}>
        <label className="registration-consent">
          <input
            type="checkbox"
            name="marketingConsent"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />{' '}
          {t('marketingConsent')}
        </label>
        <FormFeedback message={message} error={error} />
        <div className="form-actions">
          <button
            className="button button--primary"
            type="submit"
            disabled={busy}
          >
            {t(busy ? 'wait' : 'save')}
          </button>
        </div>
      </form>
    </section>
  );
}