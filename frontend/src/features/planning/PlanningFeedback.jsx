import { useLocale } from '../../shared/locale/localeContext.js';
import { hasMessage } from '../../shared/locale/messages.js';
import FeedbackMessage from '../../shared/feedback/FeedbackMessage.jsx';

export default function PlanningFeedback({ loading, error, message, onRetry }) {
  const { t } = useLocale();
  if (loading) return <FeedbackMessage messageKey="planBusy" />;
  if (!error)
    return <FeedbackMessage severity="success" messageKey={message} />;
  const code = error.code ?? error.details?.[0]?.code;
  const key = hasMessage(code)
    ? code
    : error.status === 403
      ? 'insufficientPermission'
      : error.kind === 'network' || error.kind === 'timeout'
        ? 'connectionError'
        : 'planUnavailable';
  return (
    <div role="alert" className="feedback feedback--error">
      {!hasMessage(code) &&
      error.status >= 400 &&
      error.status < 500 &&
      error.code &&
      error.message
        ? error.message
        : t(key)}
      {error.details?.map(({ path, code, message, params }, i) => (
        <div key={i}>
          {path} —{' '}
          {hasMessage(code) &&
          !['INVALID_FORECAST', 'INVALID_SUPPLIER_DOCUMENT'].includes(code)
            ? t(code)
            : message}{' '}
          {params?.reference}
        </div>
      ))}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}
