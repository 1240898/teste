import { useLocale } from '../../../shared/locale/localeContext.js';

function shortValue(t, value) {
  if (value === undefined) return t('kitchenRemovedValue');
  const text = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function ChangeList({ changes }) {
  const { t } = useLocale();
  if (!changes.length) return <p>{t('kitchenNoChanges')}</p>;
  return (
    <ul className="kitchen-changes">
      {changes.map((change) => (
        <li key={change.path}>
          <code>{change.path}</code>: {shortValue(t, change.before)} →{' '}
          {shortValue(t, change.after)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Client clarification 15 / D16: the configuration was changed by another
 * user. Offers the reload, shows the other user's changes (kept), the
 * Manager's changes re-applied on the latest version and every conflict with
 * "Keep mine" / "Keep theirs". The whole draft is never sent over latest.
 */
export default function ConcurrentChangePanel({
  phase,
  latest,
  rebase,
  resolutions,
  continued,
  reviewAcknowledged,
  busy,
  onReloadLatest,
  onResolveConflict,
  onContinueWithRebased,
  onDiscardMyDraft,
  onAcknowledgeReview,
}) {
  const { t, locale } = useLocale();
  const impossible = rebase?.status === 'rebase-impossible';
  return (
    <section
      className="kitchen-conflict"
      aria-labelledby="kitchen-conflict-title"
    >
      <h3 id="kitchen-conflict-title">{t('kitchenConflictTitle')}</h3>
      <p className="feedback feedback--error" role="alert">
        {t('kitchenConflictNotice')}
      </p>
      {latest && (
        <p>
          {t('kitchenLatestVersion', {
            version: latest.version,
            updatedAt: new Date(latest.updatedAt).toLocaleString(locale),
          })}
        </p>
      )}
      {(phase === 'conflict' || impossible) && (
        <div className="form-actions">
          <button
            className="button button--primary"
            type="button"
            disabled={busy}
            onClick={onReloadLatest}
          >
            {t('kitchenReloadLatest')}
          </button>
          {impossible && (
            <button
              className="button button--secondary"
              type="button"
              disabled={busy}
              onClick={onDiscardMyDraft}
            >
              {t('kitchenDiscardDraft')}
            </button>
          )}
        </div>
      )}
      {impossible && (
        <p className="feedback feedback--error">
          {t('kitchenRebaseImpossible')}
        </p>
      )}
      {phase === 'reviewing' && rebase?.status === 'ok' && (
        <>
          <h4>{t('kitchenTheirChanges')}</h4>
          <ChangeList changes={rebase.theirs} />
          <h4>{t('kitchenMyChanges', { version: latest.version })}</h4>
          <ChangeList changes={rebase.applied} />
          <h4>{t('kitchenConflicts')}</h4>
          {rebase.conflicts.length === 0 ? (
            <p>{t('kitchenNoChanges')}</p>
          ) : (
            <ul className="kitchen-changes">
              {rebase.conflicts.map((conflict) => (
                <li key={conflict.path}>
                  <code>{conflict.path}</code>:{' '}
                  {t('kitchenConflictValues', {
                    base: shortValue(t, conflict.base),
                    mine: shortValue(t, conflict.mine),
                    theirs: shortValue(t, conflict.theirs),
                  })}
                  <span className="kitchen-conflict__choices">
                    {['mine', 'theirs'].map((choice) => (
                      <button
                        key={choice}
                        className="button button--secondary"
                        type="button"
                        aria-pressed={resolutions[conflict.path] === choice}
                        disabled={busy || continued}
                        onClick={() => onResolveConflict(conflict.path, choice)}
                      >
                        {t(
                          choice === 'mine'
                            ? 'kitchenKeepMine'
                            : 'kitchenKeepTheirs',
                        )}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!continued && (
            <>
              {rebase.unresolved > 0 && (
                <p className="field-hint">
                  {t('kitchenResolveConflictsFirst')}
                </p>
              )}
              <div className="form-actions">
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={busy}
                  onClick={onDiscardMyDraft}
                >
                  {t('kitchenDiscardDraft')}
                </button>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={busy || rebase.unresolved > 0}
                  onClick={onContinueWithRebased}
                >
                  {t('kitchenContinueRebased')}
                </button>
              </div>
            </>
          )}
          {continued && (
            <label className="kitchen-conflict__review">
              <input
                type="checkbox"
                checked={reviewAcknowledged}
                disabled={busy}
                onChange={(event) => onAcknowledgeReview(event.target.checked)}
              />{' '}
              {t('kitchenReviewAcknowledged')}
            </label>
          )}
          {continued && !reviewAcknowledged && (
            <p className="field-hint">{t('kitchenReviewBeforeSave')}</p>
          )}
        </>
      )}
    </section>
  );
}