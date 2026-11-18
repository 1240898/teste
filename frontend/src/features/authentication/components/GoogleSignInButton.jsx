import { useState } from 'react';
import { beginGoogleSignIn } from '../services/session/googleSignIn.js';
import { useLocale } from '../../../shared/locale/localeContext.js';
import FormFeedback from '../../../shared/feedback/FormFeedback.jsx';

/** AA02: "Continue with Google", offered next to local sign-in (AA01). */
function GoogleSignInButton() {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onClick() {
    setBusy(true);
    setError('');
    try {
      await beginGoogleSignIn();
    } catch {
      setError('googleUnavailable');
      setBusy(false);
    }
  }

  return (
    <div className="google-sign-in">
      <button
        className="button button--secondary"
        type="button"
        onClick={onClick}
        disabled={busy}
      >
        {t('googleContinue')}
      </button>
      <FormFeedback error={error} />
    </div>
  );
}

export default GoogleSignInButton;
