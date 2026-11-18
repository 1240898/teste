import { Link } from 'react-router';
import { useLocale } from '../shared/locale/localeContext.js';

export default function NotFoundPage() {
  const { t } = useLocale();
  return (
    <section className="auth-card">
      <h1>{t('notFound')}</h1>
      <Link className="text-button" to="/">
        {t('returnToStart')}
      </Link>
    </section>
  );
}
