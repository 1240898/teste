import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import FeedbackMessage from '../../../shared/feedback/FeedbackMessage.jsx';
import LoadingState from '../../../shared/feedback/LoadingState.jsx';
import { toFeedback } from '../../../shared/feedback/errorMapper.js';
import { useSubmission } from '../../../shared/hooks/useSubmission.js';
import { useLocale } from '../../../shared/locale/localeContext.js';
import ActivationConfirmDialog from '../components/ActivationConfirmDialog.jsx';
import ActiveConfigurationBanner from '../components/ActiveConfigurationBanner.jsx';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog.jsx';
import JsonContentEditor from '../components/JsonContentEditor.jsx';
import { formatConfiguration } from '../configurationJson.js';
import { CONFIGURATIONS_PATH, VIEWER_PATH } from '../kitchenPaths.js';
import { actionFeedback } from '../kitchenFeedback.js';
import KitchenConfigurationEditorPage from './KitchenConfigurationEditorPage.jsx';

function download(detail) {
  const blob = new Blob([formatConfiguration(detail.content)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${detail.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Consult one configuration (SD 4) and switch to edit mode (SD 2). The editor
 * is never remounted while editing, so a token renewal or a language switch
 * keeps the draft (BR 21).
 */
export default function KitchenConfigurationDetailPage({ api }) {
  const { configurationId } = useParams();
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [detail, setDetail] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [feedback, setFeedback] = useState(
    state?.created
      ? {
          severity: 'success',
          messageKey: 'kitchenCreated',
          values: { id: state.created },
        }
      : null,
  );
  const [editing, setEditing] = useState(false);
  const [activated, setActivated] = useState(null);
  const [dialog, setDialog] = useState(null); // "activate" | "delete"
  const { isSubmitting, submit } = useSubmission();

  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');
    api
      .getById(configurationId, controller.signal)
      .then((loaded) => {
        setDetail(loaded);
        setLoadState('ready');
      })
      .catch((error) => {
        if (error?.kind === 'aborted' || controller.signal.aborted) return;
        setFeedback(
          error?.status === 404 || error?.status === 400
            ? { severity: 'error', messageKey: 'kitchenConfigurationGone' }
            : toFeedback(error),
        );
        setLoadState('error');
      });
    return () => controller.abort();
  }, [api, configurationId]);

  async function confirm() {
    const action = dialog;
    setDialog(null);
    setFeedback(null);
    setActivated(null);
    const outcome = await submit(() =>
      action === 'activate' ? api.activate(detail.id) : api.remove(detail.id),
    );
    if (outcome.phase === 'ignored') return;
    if (outcome.phase !== 'succeeded') {
      setFeedback(actionFeedback(outcome.error));
      return;
    }
    if (action === 'delete') {
      navigate(CONFIGURATIONS_PATH, { replace: true });
      return;
    }
    setActivated(outcome.result.activeConfiguration);
    setDetail((current) => ({
      ...current,
      status: 'ACTIVE',
      activatedAt: outcome.result.activeConfiguration.activatedAt,
    }));
  }

  const formatDate = (value) =>
    value ? new Date(value).toLocaleString(locale) : '—';

  return (
    <section className="kitchen-detail" aria-labelledby="kitchen-detail-title">
      <p>
        <Link to={CONFIGURATIONS_PATH}>{t('kitchenBackToList')}</Link>
      </p>
      {loadState === 'loading' && !detail && <LoadingState />}
      {feedback && <FeedbackMessage {...feedback} />}
      {detail && (
        <>
          <h2 id="kitchen-detail-title">{detail.name}</h2>
          <dl className="kitchen-detail__facts">
            <dt>{t('kitchenConfigurationId')}</dt>
            <dd>
              <code>{detail.id}</code>
            </dd>
            <dt>{t('kitchenConfigurationStatus')}</dt>
            <dd>{t(`kitchenStatus${detail.status}`)}</dd>
            <dt>{t('kitchenConfigurationVersion')}</dt>
            <dd>{detail.version}</dd>
            <dt>{t('kitchenConfigurationUpdatedAt')}</dt>
            <dd>{formatDate(detail.updatedAt)}</dd>
            <dt>{t('kitchenActivatedAt')}</dt>
            <dd>{formatDate(detail.activatedAt)}</dd>
          </dl>
          {activated && (
            <ActiveConfigurationBanner
              active={activated}
              activated={activated}
              onOpenViewer={() => navigate(VIEWER_PATH)}
            />
          )}
          {editing ? (
            <KitchenConfigurationEditorPage
              api={api}
              mode="edit"
              initial={detail}
              onSaved={(saved) => setDetail(saved)}
            />
          ) : (
            <>
              <div className="form-actions">
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setEditing(true);
                  }}
                >
                  {t('kitchenEdit')}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={isSubmitting || detail.status === 'ACTIVE'}
                  onClick={() => setDialog('activate')}
                >
                  {t('kitchenActivate')}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => download(detail)}
                >
                  {t('kitchenDownloadJson')}
                </button>
                <button
                  className="button button--danger"
                  type="button"
                  disabled={isSubmitting || detail.status === 'ACTIVE'}
                  title={
                    detail.status === 'ACTIVE'
                      ? t('kitchenDeleteDisabledHint')
                      : undefined
                  }
                  onClick={() => setDialog('delete')}
                >
                  {t('kitchenDelete')}
                </button>
              </div>
              <JsonContentEditor
                id="kitchen-detail-json"
                value={formatConfiguration(detail.content)}
                readOnly
              />
            </>
          )}
          <ActivationConfirmDialog
            target={dialog === 'activate' ? detail : null}
            currentActive={null}
            onConfirm={() => void confirm()}
            onCancel={() => setDialog(null)}
          />
          <DeleteConfirmDialog
            target={dialog === 'delete' ? detail : null}
            onConfirm={() => void confirm()}
            onCancel={() => setDialog(null)}
          />
        </>
      )}
    </section>
  );
}