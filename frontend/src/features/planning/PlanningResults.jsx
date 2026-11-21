import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../shared/locale/localeContext.js';
import PlanningFeedback from './PlanningFeedback.jsx';
import { newId } from './planningApi.js';
import { useExecutionTracker } from './useExecutionTracker.js';

function Rows({ title, columns, rows = [] }) {
  const { t } = useLocale();
  return (
    <div className="plan-table">
      <table>
        <caption>{t(title)}</caption>
        <thead>
          <tr>
            {columns.map((key) => (
              <th scope="col" key={key}>
                {t('planCol_' + key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((key) => (
                <td key={key}>{row[key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>{t('planNoRows')}</p>}
    </div>
  );
}
function Result({ run }) {
  const { t, locale } = useLocale();
  const { result, executionId } = run;
  const { data, forecast, supplierScenario } = result;
  const cost = (cents) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  return (
    <article>
      <h3>{t(result.planningType)}</h3>
      <p>{executionId}</p>
      <p>
        {result.mode === 'historicalReplay' && t('planHistorical')}{' '}
        {result.simulation && t('planSimulated')}
      </p>
      <dl>
        {[
          [
            'planSelectForecast',
            forecast && forecast.id + ' · ' + forecast.version,
          ],
          [
            'planScenario',
            supplierScenario &&
              supplierScenario.id + ' · ' + supplierScenario.version,
          ],
          ['planSnapshot', result.snapshotId],
          ['planStockSnapshot', result.stockSnapshotId],
          ['planBoms', result.bomIds?.join(', ')],
          ['planReference', result.referenceDate],
          ['planOriginal', result.replayedFrom],
        ]
          .filter(([, value]) => value != null)
          .map(([key, value]) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
      </dl>
      {result.planningType === 'BILL_OF_MATERIALS' ? (
        <Rows
          title="planMaterials"
          columns={[
            'productId',
            'requiredUnits',
            'availableUnits',
            'remainingUnits',
            'replenishmentUnits',
          ]}
          rows={Array.isArray(data) ? data : data.lines}
        />
      ) : (
        <>
          <Rows
            title="planDaily"
            columns={[
              'dueDate',
              'productId',
              'requiredUnits',
              'openingUnits',
              'closingUnits',
              'unmetAtDeadlineUnits',
              'lateUnits',
              'unfulfilledUnits',
            ]}
            rows={data.days}
          />
          <Rows
            title="planPurchases"
            columns={[
              'productId',
              'supplierId',
              'packCount',
              'purchasedUnits',
              'cost',
              'orderDate',
              'expectedDeliveryDate',
            ]}
            rows={data.proposals?.flatMap((p) =>
              p.lines.map((line) => ({
                ...line,
                supplierId: p.supplierId,
                orderDate: p.orderDate,
                cost: cost(line.costCents),
              })),
            )}
          />
          {data.warnings?.map((w, i) => (
            <p className="feedback" key={i}>
              {w.code === 'UNKNOWN_CAPACITY'
                ? t('planConditional')
                : (w.message ?? w.reason ?? w.code)}{' '}
              {w.productId} {w.supplierId} {w.dueDate}
            </p>
          ))}
        </>
      )}
      <Rows
        title="planProvenance"
        columns={['dataset', 'source', 'version', 'retrievedAt', 'simulated']}
        rows={result.provenance?.map((p) => ({
          ...p,
          simulated: t(p.simulated ? 'planYes' : 'planNo'),
        }))}
      />
      <details>
        <summary>{t('planFullResult')}</summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </article>
  );
}

function History({ api, version, busy, onOpen, onCompare, current }) {
  const { t } = useLocale();
  const [page, setPage] = useState({ items: [] });
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const id = Symbol();
    generation.current = id;
    setPage({ items: [], loading: true });
    api.history().then(
      (data) => {
        if (id === generation.current) setPage(data);
      },
      (error) => {
        if (id === generation.current) setPage({ items: [], error });
      },
    );
    return () => {
      generation.current = null;
    };
  }, [api, version, revision]);
  async function more() {
    const id = Symbol();
    generation.current = id;
    setPage({ ...page, loading: true, error: null });
    try {
      const data = await api.history(page.nextCursor);
      if (id === generation.current)
        setPage({
          items: [...page.items, ...data.items],
          nextCursor: data.nextCursor,
        });
    } catch (error) {
      if (id === generation.current) setPage({ ...page, error });
    }
  }
  return (
    <section>
      <h3>{t('planHistory')}</h3>
      <PlanningFeedback {...page} onRetry={() => setRevision((n) => n + 1)} />
      {!page.loading && !page.error && !page.items.length && (
        <p>{t('planNoHistory')}</p>
      )}
      <ul>
        {page.items.map((row) => (
          <li key={row.executionId}>
            {row.forecastId} · {row.forecastVersion} · {t(row.planningType)} ·{' '}
            {t('plan_' + row.status)} · {row.executionId}
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpen(row.executionId)}
            >
              {t('planOpen')}
            </button>
            {row.status === 'COMPLETED' &&
              row.planningType === current?.result?.planningType &&
              row.executionId !== current.executionId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onCompare(row.executionId)}
                >
                  {t('planCompare')}
                </button>
              )}
          </li>
        ))}
      </ul>
      {page.nextCursor && (
        <button type="button" disabled={page.loading} onClick={more}>
          {t('planMore')}
        </button>
      )}
    </section>
  );
}
export default function PlanningResults({
  api,
  forecasts,
  scenarios,
  visible,
}) {
  const { t } = useLocale();
  const [forecastId, setForecast] = useState('');
  const [scenarioKey, setScenario] = useState('');
  const [type, setType] = useState('REQUIREMENTS_PLANNING');
  const { state, track } = useExecutionTracker(api);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState(null);
  const daily = type === 'REQUIREMENTS_PLANNING';
  const forecast = forecasts.data?.items.find((f) => f.id === forecastId);
  const scenario = scenarios.data?.items.find(
    (s) => JSON.stringify([s.id, s.version]) === scenarioKey,
  );
  const busy = Boolean(state?.busy || comparing);
  function open(id, request, post) {
    setComparison(null);
    setError(null);
    track(id, request, post);
  }
  function start(replayedFrom) {
    const executionId = newId();
    const request = replayedFrom
      ? { executionId, replayedFrom }
      : {
          executionId,
          planningType: type,
          forecastId,
          forecastVersion: forecast.version,
          ...(daily && {
            supplierScenario: { id: scenario.id, version: scenario.version },
          }),
        };
    open(executionId, request, true);
  }
  async function compare(id) {
    setComparing(true);
    setError(null);
    setComparison(null);
    try {
      const other = await api.result(id);
      if (
        other.status !== 'COMPLETED' ||
        other.result.planningType !== state.result.planningType
      )
        throw Object.assign(new Error(), { code: 'planInvalidState' });
      setComparison(other);
    } catch (e) {
      setError(e);
    } finally {
      setComparing(false);
    }
  }
  return (
    <>
      <h2>{t('planResults')}</h2>
      <fieldset disabled={busy}>
        <legend>{t('planRun')}</legend>
        <label>
          {t('planSelectForecast')}{' '}
          <select
            aria-label={t('planSelectForecast')}
            value={forecastId}
            onChange={(e) => setForecast(e.target.value)}
          >
            <option value="">—</option>
            {forecasts.data?.items.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.version}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('planCalculation')}{' '}
          <select
            aria-label={t('planCalculation')}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {['BILL_OF_MATERIALS', 'REQUIREMENTS_PLANNING'].map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        {daily && (
          <label>
            {t('planScenario')}{' '}
            <select
              aria-label={t('planScenario')}
              value={scenarioKey}
              onChange={(e) => setScenario(e.target.value)}
            >
              <option value="">—</option>
              {scenarios.data?.items.map((s) => (
                <option
                  key={JSON.stringify([s.id, s.version])}
                  value={JSON.stringify([s.id, s.version])}
                >
                  {s.id} · {s.version}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          disabled={!forecast || (daily && !scenario) || Boolean(state?.lookup)}
          onClick={() => start()}
        >
          {t('planRun')}
        </button>
      </fieldset>
      <PlanningFeedback {...forecasts} onRetry={forecasts.reload} />
      {daily && <PlanningFeedback {...scenarios} onRetry={scenarios.reload} />}
      <PlanningFeedback loading={busy} error={error ?? state?.error} />
      {state?.status && <p role="status">{t('plan_' + state.status)}</p>}
      {state?.diagnostic && (
        <div role="alert">
          {state.diagnostic.code} · {state.diagnostic.message}
          {state.diagnostic.details?.map((d, i) => (
            <p key={i}>
              {d.path} · {d.message}
            </p>
          ))}
        </div>
      )}
      {state?.status === 'RUNNING' && state.retryable && (
        <p role="status">{t('planExpired')}</p>
      )}
      {state?.retryable && state.request && (
        <button
          type="button"
          disabled={busy}
          onClick={() => open(state.executionId, state.request, true)}
        >
          {t('retry')}
        </button>
      )}
      {state?.lookup && (
        <button
          type="button"
          disabled={busy}
          onClick={() => open(state.executionId, state.request, false)}
        >
          {t('planCheck')}
        </button>
      )}
      {state?.result && (
        <>
          <div className="plan-comparison">
            <Result run={state} />
            {comparison && <Result run={comparison} />}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => start(state.executionId)}
          >
            {t('planReplay')}
          </button>
        </>
      )}
      {visible && (
        <History
          api={api}
          current={state}
          version={state?.status === 'COMPLETED' ? state.executionId : ''}
          busy={busy}
          onOpen={(id) => open(id)}
          onCompare={compare}
        />
      )}
    </>
  );
}
