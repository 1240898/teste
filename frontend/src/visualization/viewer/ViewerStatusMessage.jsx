import FeedbackMessage from '../../shared/feedback/FeedbackMessage.jsx';
import LoadingState from '../../shared/feedback/LoadingState.jsx';
import { useLocale } from '../../shared/locale/localeContext.js';

const messages = {
  unsupported: ['viewerUnsupported', 'info'],
  empty: ['viewerEmpty', 'info'],
  invalid: ['viewerInvalid', 'error'],
  denied: ['insufficientPermission', 'error'],
  failed: ['viewerFailed', 'error'],
};

export default function ViewerStatusMessage({ state, onRetry }) {
  const { t } = useLocale();
  if (state.status === 'loading' || state.status === 'loading-assets')
    return (
      <LoadingState
        labelKey={
          state.status === 'loading' ? 'viewerLoading' : 'viewerLoadingAssets'
        }
      />
    );

  const showAssetId =
    state.status === 'error' && state.reason === 'asset-unavailable';
  const message =
    state.status === 'error'
      ? [showAssetId ? 'viewerAssetUnavailable' : 'viewerUnavailable', 'error']
      : messages[state.status];
  if (!message) return null;

  return (
    <>
      <FeedbackMessage
        severity={message[1]}
        messageKey={message[0]}
        values={showAssetId ? { assetId: state.assetId } : undefined}
      />
      {(state.status === 'error' || state.status === 'failed') && (
        <button
          className="button button--secondary"
          type="button"
          onClick={onRetry}
        >
          {t('retry')}
        </button>
      )}
    </>
  );
}
