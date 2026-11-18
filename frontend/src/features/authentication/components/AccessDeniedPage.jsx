import { Link } from 'react-router';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { messageKey as resolveMessage } from '../../../shared/locale/messageKeys.js';

/** AA03: access-denied message (inactive account, no role, or insufficient role). */
function AccessDeniedPage({
  message,
  messageKey = 'insufficientPermission',
  onBack,
  showStart = true,
}) {
  const { t } = useLocale();
  return (
    <section
      className="auth-card"
      role="alert"
      aria-labelledby="access-denied-title"
    >
      <h1 id="access-denied-title">{t('accessDenied')}</h1>
      <p className="feedback feedback--error">
        {t(resolveMessage(message, messageKey))}
      </p>
      {showStart && (
        <Link className="text-button" to="/">
          {t('returnToStart')}
        </Link>
      )}
      {onBack && (
        <button
          className="button button--secondary"
          type="button"
          onClick={onBack}
        >
          {t('backToSignIn')}
        </button>
      )}
    </section>
  );
}

export default AccessDeniedPage;
