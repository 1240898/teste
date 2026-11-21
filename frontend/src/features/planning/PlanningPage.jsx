import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '../../shared/locale/localeContext.js';
import { planningApi } from './planningApi.js';
import { usePlanningResource } from './usePlanningResource.js';
import ForecastEditor from './ForecastEditor.jsx';
import SupplierScenarioForm from './SupplierScenarioForm.jsx';
import PlanningResults from './PlanningResults.jsx';

export default function PlanningPage({ request }) {
  const { t } = useLocale();
  const latest = useRef(request);
  useLayoutEffect(() => {
    latest.current = request;
  }, [request]);
  const api = useMemo(
    () => planningApi((...args) => latest.current(...args)),
    [],
  );
  const forecasts = usePlanningResource(api.forecasts);
  const options = usePlanningResource(api.options);
  const scenarios = usePlanningResource(api.scenarios);
  const [tab, setTab] = useState('planForecasts');
  return (
    <section className="planning-workspace">
      <h1>{t('planning')}</h1>
      <nav aria-label={t('planning')}>
        {['planForecasts', 'planSuppliers', 'planResults'].map((key) => (
          <button
            className="button button--secondary"
            type="button"
            aria-pressed={tab === key}
            key={key}
            onClick={() => setTab(key)}
          >
            {t(key)}
          </button>
        ))}
      </nav>
      <section hidden={tab !== 'planForecasts'}>
        <ForecastEditor api={api} forecasts={forecasts} options={options} />
      </section>
      <section hidden={tab !== 'planSuppliers'}>
        <SupplierScenarioForm api={api} scenarios={scenarios} />
      </section>
      <section hidden={tab !== 'planResults'}>
        <PlanningResults
          api={api}
          forecasts={forecasts}
          scenarios={scenarios}
          visible={tab === 'planResults'}
        />
      </section>
    </section>
  );
}
