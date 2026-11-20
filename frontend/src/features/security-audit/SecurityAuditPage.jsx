import { useEffect, useState } from 'react';
import { useLocale } from '../../shared/locale/localeContext.js';
import { searchSecurityAuditLogs } from './securityAuditApi.js';

const PAGE_SIZE = 25;

function SecurityAuditPage({ token, onBack }) {
  const { t } = useLocale();
  const [filters, setFilters] = useState({
    outcome: '',
    actorId: '',
    from: '',
    to: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    searchSecurityAuditLogs(token, {
      ...appliedFilters,
      limit: PAGE_SIZE,
      offset,
    })
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, appliedFilters, offset, refreshKey]);

  function applyFilters(event) {
    event.preventDefault();
    setOffset(0);
    setAppliedFilters({ ...filters });
  }

  return (
    <section className="audit-page" aria-labelledby="audit-title">
      <div className="audit-heading">
        <div>
          <p className="eyebrow">{t('roleADMINISTRATOR')}</p>
          <h1 id="audit-title">{t('securityAudit')}</h1>
          <p className="intro">{t('securityAuditIntro')}</p>
        </div>
        <button type="button" className="text-button" onClick={onBack}>
          {t('returnToStart')}
        </button>
      </div>

      <form className="audit-filters" onSubmit={applyFilters}>
        <label>
          {t('auditOutcome')}
          <select
            value={filters.outcome}
            onChange={(event) =>
              setFilters({ ...filters, outcome: event.target.value })
            }
          >
            <option value="">{t('allOutcomes')}</option>
            <option value="UNAUTHENTICATED">{t('unauthenticated')}</option>
            <option value="FORBIDDEN">{t('forbidden')}</option>
            <option value="OWNERSHIP_DENIED">{t('ownershipDenied')}</option>
          </select>
        </label>
        <label>
          {t('actorId')}
          <input
            value={filters.actorId}
            onChange={(event) =>
              setFilters({ ...filters, actorId: event.target.value })
            }
            placeholder="USR-00001"
          />
        </label>
        <label>
          {t('fromDate')}
          <input
            type="datetime-local"
            value={filters.from}
            onChange={(event) =>
              setFilters({ ...filters, from: event.target.value })
            }
          />
        </label>
        <label>
          {t('toDate')}
          <input
            type="datetime-local"
            value={filters.to}
            onChange={(event) =>
              setFilters({ ...filters, to: event.target.value })
            }
          />
        </label>
        <button type="submit">{t('search')}</button>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p role="status">{t('loadingAuditEvents')}</p>}

      {!loading && !error && (
        <>
          <div className="audit-results-heading">
            <p>{t('auditEventCount', { count: result.total })}</p>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              {t('refresh')}
            </button>
          </div>
          {result.items.length === 0 ? (
            <p>{t('noAuditEvents')}</p>
          ) : (
            <div className="audit-table-scroll">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th scope="col">{t('auditTime')}</th>
                    <th scope="col">{t('auditOutcome')}</th>
                    <th scope="col">{t('auditRequest')}</th>
                    <th scope="col">{t('auditStatus')}</th>
                    <th scope="col">{t('auditActor')}</th>
                    <th scope="col">{t('auditRoles')}</th>
                    <th scope="col">{t('requestId')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr key={item.requestId}>
                      <td>{new Date(item.timestamp).toLocaleString()}</td>
                      <td>{item.outcome}</td>
                      <td>
                        {item.method} {item.routeTemplate}
                      </td>
                      <td>{item.statusCode}</td>
                      <td>{item.actorId ?? t('unauthenticated')}</td>
                      <td>{item.actorRoles.join(', ') || '—'}</td>
                      <td>{item.requestId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="audit-pagination">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {t('previous')}
            </button>
            <span>
              {t('auditShowingRange', {
                start: result.items.length ? offset + 1 : 0,
                end: offset + result.items.length,
                total: result.total,
              })}
            </span>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= result.total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {t('next')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default SecurityAuditPage;
