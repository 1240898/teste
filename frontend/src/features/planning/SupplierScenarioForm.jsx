import { useState } from 'react';
import { useLocale } from '../../shared/locale/localeContext.js';
import { useSubmission } from '../../shared/hooks/useSubmission.js';
import PlanningFeedback from './PlanningFeedback.jsx';
import { uncertain } from './planningApi.js';

export default function SupplierScenarioForm({ api, scenarios }) {
  const { t } = useLocale();
  const { submit, isSubmitting } = useSubmission();
  const [preview, setPreview] = useState(null);
  const [recover, setRecover] = useState(false);
  const [feedback, setFeedback] = useState({});
  async function run(operation) {
    setFeedback({});
    const outcome = await submit(operation);
    if (outcome.error) setFeedback({ error: outcome.error });
  }
  function download() {
    return run(async () => {
      const data = await api.exportProducts();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'planning-products.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback({
        message: data.products.length ? 'planExported' : 'planExportEmpty',
      });
    });
  }
  function inspect(file) {
    if (!file) return;
    setPreview(null);
    setRecover(false);
    return run(async () => {
      const contents = await file.text();
      let document;
      try {
        document = JSON.parse(contents);
      } catch {
        throw Object.assign(new Error(), { code: 'INVALID_JSON' });
      }
      setPreview(await api.preview(document));
    });
  }
  async function confirmed(result) {
    setPreview(null);
    setRecover(false);
    setFeedback({
      message: 'planConfirmed',
      id: result.id,
      version: result.version,
    });
    await scenarios.reload();
  }
  function confirm() {
    return run(async () => {
      if (recover) {
        const state = await api.getPreview(preview.previewId);
        if (state.status === 'CONFIRMED') return confirmed(state.scenario);
        setPreview(state);
        setRecover(false);
        return;
      }
      try {
        await confirmed(await api.confirm(preview.previewId));
      } catch (error) {
        if (uncertain(error)) setRecover(true);
        throw error;
      }
    });
  }
  return (
    <>
      <h2>{t('planSuppliers')}</h2>
      <button type="button" disabled={isSubmitting} onClick={download}>
        {t('planExport')}
      </button>
      <details>
        <summary>{t('planFormat')}</summary>
        <p>{t('planFormatHelp')}</p>
        <pre>
          {JSON.stringify(
            {
              suppliers: [{ id: 'A' }, { id: 'B' }],
              products: [
                {
                  productId: 'PROD-90030',
                  stockUnit: 'unit',
                  offers: [
                    {
                      supplierId: 'A',
                      priceEur: '10.00',
                      coveredUnits: 6,
                      leadTimeDays: 0,
                      dailyLimit: 12,
                    },
                    {
                      supplierId: 'B',
                      priceEur: '15.50',
                      coveredUnits: 10,
                      leadTimeDays: 2,
                    },
                  ],
                },
              ],
            },
            null,
            2,
          )}
        </pre>
      </details>
      <label>
        {t('planImport')}{' '}
        <input
          disabled={isSubmitting || recover}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files[0];
            e.target.value = '';
            inspect(file);
          }}
        />
      </label>
      {preview && (
        <section>
          <h3>{t('planPreview')}</h3>
          <p>{t('planSimulated')}</p>
          <p>
            {t('planExpires')} {preview.expiresAt}
          </p>
          <ul>
            {preview.document.suppliers.map((s) => (
              <li key={s.id}>
                {s.name ?? s.id} ({s.id})
              </li>
            ))}
          </ul>
          <table>
            <caption>{t('planOffers')}</caption>
            <thead>
              <tr>
                {[
                  'planProduct',
                  'planUnit',
                  'planSupplier',
                  'planPrice',
                  'planPack',
                  'planLead',
                  'planLimit',
                ].map((k) => (
                  <th key={k} scope="col">
                    {t(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.document.products.flatMap((p) =>
                p.offers.map((o) => (
                  <tr key={JSON.stringify([p.productId, o.supplierId])}>
                    {[
                      p.productId,
                      p.stockUnit,
                      o.supplierId,
                      o.priceEur,
                      o.coveredUnits,
                      o.leadTimeDays,
                      o.dailyLimit ?? t('planUnknown'),
                    ].map((value, i) => (
                      <td key={i}>{value}</td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
          <h4>{t('planWithoutOffers')}</h4>
          <ul>
            {preview.withoutOffers.map((p) => (
              <li key={p.productId}>
                {p.name} · {p.productId}
              </li>
            ))}
          </ul>
          <button type="button" disabled={isSubmitting} onClick={confirm}>
            {t(recover ? 'planCheck' : 'planConfirm')}
          </button>
          <button
            type="button"
            disabled={isSubmitting || recover}
            onClick={() => setPreview(null)}
          >
            {t('cancel')}
          </button>
        </section>
      )}
      <PlanningFeedback {...feedback} loading={isSubmitting} />
      {feedback.id && (
        <p>
          {feedback.id} · {feedback.version}
        </p>
      )}
      <h3>{t('planConfirmedList')}</h3>
      <PlanningFeedback {...scenarios} onRetry={scenarios.reload} />
      {scenarios.data &&
        (scenarios.data.items.length ? (
          <ul>
            {scenarios.data.items.map((s) => (
              <li key={JSON.stringify([s.id, s.version])}>
                {s.id} · {t('planVersion')} {s.version} · {t('planSimulated')}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('planNoScenarios')}</p>
        ))}
    </>
  );
}
