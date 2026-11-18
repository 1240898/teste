import { useLocale } from '../locale/localeContext.js';

export default function EmptyState({
  titleKey,
  values,
  descriptionKey,
  actionLabelKey,
  onAction,
}) {
  const { t } = useLocale();
  return (
    <section className="empty-state" aria-live="polite">
      <p className="feedback" role="status">
        {t(titleKey, values)}
      </p>
      {descriptionKey && <p>{t(descriptionKey)}</p>}
      {actionLabelKey && onAction && (
        <button
          className="button button--secondary"
          type="button"
          onClick={onAction}
        >
          {t(actionLabelKey)}
        </button>
      )}
    </section>
  );
}
