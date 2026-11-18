import { useLocale } from '../locale/localeContext.js';

export default function FeedbackMessage({
  severity = 'info',
  messageKey,
  values,
}) {
  const { t } = useLocale();
  if (!messageKey) return null;

  const role = severity === 'error' ? 'alert' : 'status';
  return (
    <p className={`feedback feedback--${severity}`} role={role}>
      {t(messageKey, values)}
    </p>
  );
}
