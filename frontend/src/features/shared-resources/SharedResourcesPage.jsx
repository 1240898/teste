import { useEffect, useState } from 'react';
import { apiClient } from '../../shared/api/apiClient.js';
import { useLocale } from '../../shared/locale/localeContext.js';

const resourcePath = '/shared-resources';
const documentPath = (name) => `${resourcePath}/${encodeURIComponent(name)}`;
const extension = (name) => name.slice(name.lastIndexOf('.')).toLowerCase();
const confirmedPublication = { 'X-Confirm-Shared-Publication': 'true' };

function saveDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SharedResourcesPage({ token, canManage }) {
  const { t } = useLocale();
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get(resourcePath, { accessToken: token, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setItems(result.items);
        setLoadError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [token, revision]);

  async function perform(action, successKey) {
    setFeedback(null);
    setBusy(true);
    try {
      await action();
      if (successKey) {
        setFeedback({ key: successKey });
        setRevision((current) => current + 1);
      }
    } catch (error) {
      const key =
        {
          401: 'signInRequired',
          403: 'insufficientPermission',
          404: 'sharedDocumentMissing',
          409: 'sharedDocumentExists',
          413: 'sharedDocumentTooLarge',
        }[error.status] ?? 'sharedDocumentError';
      setFeedback({ key, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function publish(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get('document');
    if (
      !(file instanceof File) ||
      !file.size ||
      (replacing && extension(file.name) !== extension(replacing))
    ) {
      setFeedback({ key: 'sharedDocumentError', error: true });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ key: 'sharedDocumentTooLarge', error: true });
      return;
    }
    const method = replacing ? 'PUT' : 'POST';
    await perform(
      async () => {
        await apiClient.request(method, documentPath(replacing ?? file.name), {
          body: file,
          accessToken: token,
          headers: confirmedPublication,
        });
        form.reset();
        setReplacing(null);
      },
      replacing ? 'sharedDocumentReplaced' : 'sharedDocumentPublished',
    );
  }

  function download(name) {
    return perform(async () => {
      const blob = await apiClient.get(documentPath(name), {
        accessToken: token,
        responseType: 'blob',
      });
      saveDownload(blob, name);
    });
  }

  function remove(name) {
    if (!window.confirm(t('sharedDocumentConfirmDelete', { name }))) return;
    return perform(async () => {
      await apiClient.delete(documentPath(name), { accessToken: token });
      if (replacing === name) setReplacing(null);
    }, 'sharedDocumentDeleted');
  }

  return (
    <section className="audit-page" aria-labelledby="shared-resources-title">
      <h1 id="shared-resources-title">{t('sharedResources')}</h1>
      {canManage && (
        <form
          key={replacing ?? 'new'}
          className="audit-filters"
          onSubmit={publish}
        >
          <label>
            {replacing
              ? t('sharedDocumentReplacing', { name: replacing })
              : t('sharedDocumentFile')}
            <input
              type="file"
              name="document"
              accept={replacing ? extension(replacing) : '.pdf,.docx,.txt'}
              required
              disabled={busy}
            />
          </label>
          <label>
            <span>
              <input type="checkbox" required disabled={busy} />{' '}
              {t('sharedDocumentConfirmPublication')}
            </span>
          </label>
          <button type="submit" disabled={busy}>
            {t(replacing ? 'sharedDocumentReplace' : 'sharedDocumentPublish')}
          </button>
          {replacing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setReplacing(null)}
            >
              {t('cancel')}
            </button>
          )}
        </form>
      )}
      {feedback && (
        <p role={feedback.error ? 'alert' : 'status'}>{t(feedback.key)}</p>
      )}
      {loadError && <p role="alert">{t('sharedDocumentsLoadError')}</p>}
      {!items && !loadError && (
        <p role="status">{t('sharedDocumentsLoading')}</p>
      )}
      {!loadError && items?.length === 0 && <p>{t('sharedDocumentsEmpty')}</p>}
      {!loadError && Boolean(items?.length) && (
        <table className="audit-table">
          <thead>
            <tr>
              <th scope="col">{t('sharedDocumentName')}</th>
              <th scope="col">{t('sharedDocumentActions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ name }) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => download(name)}
                  >
                    {t('sharedDocumentDownload')}
                  </button>{' '}
                  {canManage && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setReplacing(name)}
                      >
                        {t('sharedDocumentReplace')}
                      </button>{' '}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(name)}
                      >
                        {t('sharedDocumentDelete')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
