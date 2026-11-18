import { useEffect, useState } from 'react';
import { getHealth } from './services/healthApi.js';
import { useLocale } from '../shared/locale/localeContext.js';

export default function ConnectionStatus() {
  const { t } = useLocale();
  const [message, setMessage] = useState('connecting');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setMessage(result?.status === 'ok' ? 'connected' : 'disconnected');
      })
      .catch(() => {
        if (!controller.signal.aborted) setMessage('disconnected');
      });
    return () => controller.abort();
  }, [attempt]);

  return (
      <div className={`connection-status connection-status--${message}`}>
      <span role="status">{t(message)}</span>
      {message === 'disconnected' && (
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            setMessage('connecting');
            setAttempt((previous) => previous + 1);
          }}
        >
          {t('retryConnection')}
        </button>
      )}
    </div>
  );
}
