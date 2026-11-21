import { useRef, useState } from 'react';
import { useLocale } from '../../shared/locale/localeContext.js';
import { useSubmission } from '../../shared/hooks/useSubmission.js';
import ConfirmationDialog from '../../shared/feedback/ConfirmationDialog.jsx';
import PlanningFeedback from './PlanningFeedback.jsx';
import { newId, uncertain } from './planningApi.js';

const blank = () => ({ name: '', startDate: '', endDate: '', entries: [] });
export default function ForecastEditor({ api, forecasts, options }) {
  const { t } = useLocale();
  const [draft, setDraft] = useState(blank);
  const [selection, setSelection] = useState(null);
  const [stale, setStale] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState({});
  const pendingCreate = useRef(null);
  const { submit, isSubmitting } = useSubmission();
  const products = options.data?.products ?? [];
  const locked = isSubmitting || Boolean(pendingCreate.current) || stale;
  const update = (field, value) =>
    setDraft((prev) => ({ ...prev, [field]: value }));
  const replace = (index, changes) =>
    update(
      'entries',
      draft.entries.map((line, i) =>
        i === index ? { ...line, ...changes } : line,
      ),
    );
  function load(record) {
    const { id, version, ...fields } = record;
    setSelection({ id, version });
    setDraft(fields);
    setStale(false);
  }
  function reset() {
    setSelection(null);
    setDraft(blank());
    setStale(false);
    setFeedback({});
  }
  async function act(operation) {
    setFeedback({});
    const result = await submit(operation);
    if (result.error) setFeedback({ error: result.error });
  }
  async function refresh(id, currentRecord) {
    try {
      load(await api.getForecast(id));
    } catch (error) {
      if (error.status === 404) {
        if (currentRecord) reset();
        await forecasts.reload();
      } else if (currentRecord) setStale(true);
      throw error;
    }
  }
  const open = (id) => act(() => refresh(id, selection?.id === id));
  async function save(event) {
    event.preventDefault();
    await act(async () => {
      let saved;
      try {
        if (selection)
          saved = await api.update(selection.id, {
            ...draft,
            version: selection.version,
          });
        else {
          pendingCreate.current ??= { ...draft, creationRequestId: newId() };
          saved = await api.create(pendingCreate.current);
        }
      } catch (error) {
        if (selection && (error.status === 409 || uncertain(error)))
          setStale(true);
        if (!uncertain(error)) pendingCreate.current = null;
        throw error;
      }
      pendingCreate.current = null;
      setSelection(saved);
      await forecasts.reload();
      await refresh(saved.id, true);
      setFeedback({ message: 'planSaved' });
    });
  }
  async function archive() {
    setDeleting(false);
    await act(async () => {
      try {
        await api.archive(selection.id, selection.version);
      } catch (error) {
        if (error.status === 409 || uncertain(error)) {
          setStale(true);
          await forecasts.reload();
        }
        throw error;
      }
      reset();
      setFeedback({ message: 'planArchived' });
      await forecasts.reload();
    });
  }
  const invalid = (path) =>
    feedback.error?.details?.some((issue) => issue.path === path) || undefined;
  return (
    <>
      <h2>{t('planForecasts')}</h2>
      <PlanningFeedback {...forecasts} onRetry={forecasts.reload} />
      <label>
        {t('planSelectForecast')}{' '}
        <select
          aria-label={t('planSelectForecast')}
          value={selection?.id ?? ''}
          disabled={isSubmitting || Boolean(pendingCreate.current)}
          onChange={(e) => (e.target.value ? open(e.target.value) : reset())}
        >
          <option value="">{t('planNew')}</option>
          {forecasts.data?.items.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} · {f.version}
            </option>
          ))}
        </select>
      </label>
      {forecasts.data?.items.length === 0 && <p>{t('planNoForecasts')}</p>}
      {selection && (
        <p>
          {selection.id} · {t('planVersion')} {selection.version}
        </p>
      )}
      <PlanningFeedback {...options} onRetry={options.reload} />
      <form onSubmit={save}>
        <fieldset disabled={locked}>
          <legend>{t('planPeriod')}</legend>
          <label>
            {t('name')}{' '}
            <input
              required
              value={draft.name}
              aria-invalid={invalid('name')}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <label>
            {t('planStart')}{' '}
            <input
              required
              type="date"
              value={draft.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </label>
          <label>
            {t('planEnd')}{' '}
            <input
              required
              type="date"
              min={draft.startDate}
              value={draft.endDate}
              onChange={(e) => update('endDate', e.target.value)}
            />
          </label>
        </fieldset>
        <fieldset disabled={locked}>
          <legend>{t('planEntries')}</legend>
          <p>{t('planZero')}</p>
          {draft.entries.map((line, i) => {
            const product = products.find(
              (p) => p.productId === line.productId,
            );
            return (
              <fieldset key={i}>
                <legend>
                  {t('planLine')} {i + 1}
                </legend>
                <label>
                  {t('planDate')}{' '}
                  <input
                    required
                    type="date"
                    min={draft.startDate}
                    max={draft.endDate}
                    value={line.date}
                    aria-invalid={
                      line.date < draft.startDate ||
                      line.date > draft.endDate ||
                      invalid('entries.' + i + '.date')
                    }
                    onChange={(e) => replace(i, { date: e.target.value })}
                  />
                </label>
                <label>
                  {t('planProduct')}{' '}
                  <select
                    aria-label={t('planProduct')}
                    required
                    value={line.productId}
                    aria-invalid={invalid('entries.' + i + '.productId')}
                    onChange={(e) =>
                      replace(i, {
                        productId: e.target.value,
                        sizeId: undefined,
                      })
                    }
                  >
                    <option value="">—</option>
                    {line.productId && !product && (
                      <option value={line.productId}>
                        {line.productId} · {t('planInactive')}
                      </option>
                    )}
                    {products.map((p) => (
                      <option key={p.productId} value={p.productId}>
                        {p.name} · {p.productId}
                      </option>
                    ))}
                  </select>
                </label>
                {(product?.isPizza || line.sizeId) && (
                  <label>
                    {t('planSize')}{' '}
                    <select
                      aria-label={t('planSize')}
                      required
                      value={line.sizeId ?? ''}
                      aria-invalid={invalid('entries.' + i + '.sizeId')}
                      onChange={(e) => replace(i, { sizeId: e.target.value })}
                    >
                      <option value="">—</option>
                      {line.sizeId &&
                        !product?.sizes.some((s) => s.id === line.sizeId) && (
                          <option value={line.sizeId}>
                            {line.sizeId} · {t('planInactive')}
                          </option>
                        )}
                      {product?.sizes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  {t('planQuantity')}{' '}
                  <input
                    type="number"
                    required
                    min="0"
                    max={Number.MAX_SAFE_INTEGER}
                    step="1"
                    value={line.quantity}
                    aria-invalid={invalid('entries.' + i + '.quantity')}
                    onChange={(e) =>
                      replace(i, {
                        quantity:
                          e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    update(
                      'entries',
                      draft.entries.filter((_, n) => n !== i),
                    )
                  }
                >
                  {t('planRemoveLine')}
                </button>
              </fieldset>
            );
          })}
          <button
            type="button"
            disabled={
              !draft.startDate ||
              !draft.endDate ||
              draft.endDate < draft.startDate ||
              !products.length
            }
            onClick={() =>
              update('entries', [
                ...draft.entries,
                { date: draft.startDate, productId: '', quantity: 0 },
              ])
            }
          >
            {t('planAddLine')}
          </button>
        </fieldset>
        <button
          className="button"
          disabled={isSubmitting || stale || !options.data}
        >
          {t(pendingCreate.current ? 'retry' : 'save')}
        </button>
        {selection && (
          <button
            type="button"
            disabled={locked}
            onClick={() => setDeleting(true)}
          >
            {t('delete')}
          </button>
        )}
        {stale && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => open(selection.id)}
          >
            {t('planReload')}
          </button>
        )}
      </form>
      <PlanningFeedback {...feedback} loading={isSubmitting} />
      {pendingCreate.current && !isSubmitting && <p>{t('planRetryCreate')}</p>}
      <ConfirmationDialog
        open={deleting}
        consequenceKey="planDeletePrompt"
        onConfirm={archive}
        onCancel={() => setDeleting(false)}
      />
    </>
  );
}
