import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import EmptyState from '../../../shared/feedback/EmptyState.jsx';
import FeedbackMessage from '../../../shared/feedback/FeedbackMessage.jsx';
import LoadingState from '../../../shared/feedback/LoadingState.jsx';
import { toFeedback } from '../../../shared/feedback/errorMapper.js';
import { actionFeedback } from '../kitchenFeedback.js';
import { useSubmission } from '../../../shared/hooks/useSubmission.js';
import { useLocale } from '../../../shared/locale/localeContext.js';
import ActivationConfirmDialog from '../components/ActivationConfirmDialog.jsx';
import ActiveConfigurationBanner from '../components/ActiveConfigurationBanner.jsx';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog.jsx';
import {
  CONFIGURATIONS_PATH,
  VIEWER_PATH,
  configurationPath,
} from '../kitchenPaths.js';

/**
 * List of kitchen configurations (SD 3, SD 4). Re-reads the list after every
 * successful change (WEB01 BR 14). Delete is disabled for the ACTIVE row (the
 * back end also rejects it with 409).
 */
export default function KitchenConfigurationListPage({ api }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [configurations, setConfigurations] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [activated, setActivated] = useState(null);
  const [toActivate, setToActivate] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const { isSubmitting, submit } = useSubmission();

  const load = useCallback(
    async (signal) => {
      setLoadState('loading');
      try {
        const list = await api.list(signal);
        setConfigurations(Array.isArray(list) ? list : []);
        setLoadError(null);
        setLoadState('ready');
        return list;
      } catch (error) {
        if (error?.kind === 'aborted' || signal?.aborted) return null;
        setLoadError(toFeedback(error));
        setLoadState('error');
        return null;
      }
    },
    [api],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const active =
    configurations.find((item) => item.status === 'ACTIVE') ?? null;

  async function confirmActivation() {
    const target = toActivate;
    setToActivate(null);
    setFeedback(null);
    setActivated(null);
    const outcome = await submit(() => api.activate(target.id));
    if (outcome.phase === 'ignored') return;
    await load();
    if (outcome.phase === 'succeeded')
      setActivated(outcome.result.activeConfiguration);
    else setFeedback(actionFeedback(outcome.error));
  }

  async function confirmDeletion() {
    const target = toDelete;
    setToDelete(null);
    setFeedback(null);
    setActivated(null);
    const outcome = await submit(() => api.remove(target.id));
    if (outcome.phase === 'ignored') return;
    await load();
    setFeedback(
      outcome.phase === 'succeeded'
        ? { severity: 'success', messageKey: 'kitchenDeleted' }
        : actionFeedback(outcome.error),
    );
  }

  const formatDate = (value) =>
    value ? new Date(value).toLocaleString(locale) : '—';

  return (
    <section
      className="kitchen-configurations"
      aria-labelledby="kitchen-list-title"
    >
      <h2 id="kitchen-list-title" className="visually-hidden">
        {t('kitchenConfigurations')}
      </h2>
      <p className="intro">{t('kitchenConfigurationsIntro')}</p>
      <div className="form-actions">
        <Link
          className="button button--primary"
          to={`${CONFIGURATIONS_PATH}/new`}
        >
          {t('newKitchenConfiguration')}
        </Link>
      </div>
      {loadState === 'ready' && (
        <ActiveConfigurationBanner
          active={active}
          activated={activated}
          onOpenViewer={() => navigate(VIEWER_PATH)}
        />
      )}
      {feedback && <FeedbackMessage {...feedback} />}
      {loadState === 'loading' && configurations.length === 0 && (
        <LoadingState />
      )}
      {loadState === 'error' && (
        <>
          <FeedbackMessage
            severity="error"
            messageKey="kitchenListLoadFailed"
          />
          {loadError && <FeedbackMessage {...loadError} />}
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void load()}
          >
            {t('retry')}
          </button>
        </>
      )}
      {loadState === 'ready' && configurations.length === 0 && (
        <EmptyState
          titleKey="kitchenNoConfigurations"
          descriptionKey="kitchenNoConfigurationsHint"
        />
      )}
      {configurations.length > 0 && loadState !== 'error' && (
        <table className="kitchen-table">
          <thead>
            <tr>
              <th scope="col">{t('kitchenConfigurationName')}</th>
              <th scope="col">{t('kitchenConfigurationId')}</th>
              <th scope="col">{t('kitchenConfigurationStatus')}</th>
              <th scope="col">{t('kitchenConfigurationVersion')}</th>
              <th scope="col">{t('kitchenConfigurationElements')}</th>
              <th scope="col">{t('kitchenConfigurationUpdatedAt')}</th>
              <th scope="col">{t('kitchenConfigurationActions')}</th>
            </tr>
          </thead>
          <tbody>
            {configurations.map((item) => {
              const isActive = item.status === 'ACTIVE';
              return (
                <tr key={item.id} data-configuration-id={item.id}>
                  <td>
                    <Link to={configurationPath(item.id)}>{item.name}</Link>
                  </td>
                  <td>
                    <code>{item.id}</code>
                  </td>
                  <td>
                    <span className={`tag${isActive ? '' : ' tag--muted'}`}>
                      {t(`kitchenStatus${item.status}`)}
                    </span>
                  </td>
                  <td>{item.version}</td>
                  <td>{item.elementCount}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td className="kitchen-table__actions">
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={isSubmitting || isActive}
                      onClick={() => setToActivate(item)}
                    >
                      {t('kitchenActivate')}
                    </button>
                    <button
                      className="button button--danger"
                      type="button"
                      disabled={isSubmitting || isActive}
                      title={
                        isActive ? t('kitchenDeleteDisabledHint') : undefined
                      }
                      onClick={() => setToDelete(item)}
                    >
                      {t('kitchenDelete')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <ActivationConfirmDialog
        target={toActivate}
        currentActive={active}
        onConfirm={() => void confirmActivation()}
        onCancel={() => setToActivate(null)}
      />
      <DeleteConfirmDialog
        target={toDelete}
        onConfirm={() => void confirmDeletion()}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}