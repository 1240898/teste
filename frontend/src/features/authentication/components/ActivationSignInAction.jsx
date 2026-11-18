import { Link, useNavigate } from 'react-router';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { useAuth } from '../state/authContext.js';

export default function ActivationSignInAction() {
  const { t } = useLocale();
  const auth = useAuth();
  const navigate = useNavigate();

  if (auth.status === 'loading') return null;
  if (auth.status === 'guest') {
    return (
      <Link className="button button--secondary" to="/login">
        {t('backToSignIn')}
      </Link>
    );
  }

  const logoutPending = auth.status === 'logoutPending';
  const signingOut = logoutPending && auth.message === 'Signing out…';

  async function switchAccount() {
    if (await auth.logout()) navigate('/login', { replace: true });
  }

  return (
    <>
      {auth.status === 'authenticated' && (
        <p>{t('activationExistingSession', { email: auth.user.email })}</p>
      )}
      {logoutPending && (
        <p role={signingOut ? 'status' : 'alert'}>
          {t(signingOut ? 'signingOut' : 'logoutUnconfirmed')}
        </p>
      )}
      <button
        className="button button--secondary"
        type="button"
        disabled={signingOut}
        onClick={switchAccount}
      >
        {t(
          signingOut
            ? 'signingOut'
            : logoutPending
              ? 'retryLogout'
              : 'activationSwitchAccount',
        )}
      </button>
    </>
  );
}
