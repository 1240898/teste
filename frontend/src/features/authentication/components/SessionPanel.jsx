import { useLocale } from '../../../shared/locale/localeContext.js';

/**
 * AA02 / WEB03: Account section. Shows who is signed in and, for local
 * accounts, the password change. Logout lives in the header (top-right).
 */
function SessionPanel({ session, onChangePassword }) {
  const { user } = session;
  const { t } = useLocale();
  return (
    <section className="auth-card" aria-labelledby="session-title">
      <h1 id="session-title">{t('account')}</h1>
      <p className="feedback feedback--success" role="status">
        {t('signedInAs', { name: user.name })}
      </p>
      <dl>
        <dt>{t('email')}</dt>
        <dd>{user.email}</dd>
        <dt>{t('role')}</dt>
        <dd>
          {user.roles
            .map((role) =>
              ['ADMINISTRATOR', 'MANAGER', 'EMPLOYEE', 'CUSTOMER'].includes(
                role,
              )
                ? t(`role${role}`)
                : role,
            )
            .join(', ')}
        </dd>
      </dl>
      {session.hasLocalCredential && (
        <div className="form-actions">
          <button
            className="button button--primary"
            type="button"
            onClick={onChangePassword}
          >
            {t('changePassword')}
          </button>
        </div>
      )}
    </section>
  );
}

export default SessionPanel;