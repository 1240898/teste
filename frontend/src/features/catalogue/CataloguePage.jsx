import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useLocale } from '../../shared/locale/localeContext.js';
import { apiMessageKey } from '../../shared/locale/messageKeys.js';
import { catalogueApi } from './catalogueApi.js';
import { formatPrice, lowestSizePrice } from './catalogueFormat.js';
import { AllergenList, AvailabilityTag } from './CatalogueParts.jsx';
import EmptyState from '../../shared/feedback/EmptyState.jsx';
import FeedbackMessage from '../../shared/feedback/FeedbackMessage.jsx';
import LoadingState from '../../shared/feedback/LoadingState.jsx';

function ProductPrice({ product }) {
  const { locale, t } = useLocale();
  if (!product.pizza) return formatPrice(product.price, locale);
  const lowest = lowestSizePrice(product);
  return lowest
    ? t('priceFrom', { price: formatPrice(lowest, locale) })
    : t('unavailable');
}

/**
 * WEB03 (BR 4, AC 4): public, read-only sellable catalogue (BCK11 API) for
 * every role, Guest included. Only the search the API offers is exposed
 * (componentName); management pages stay with WEB05.
 */
export default function CataloguePage() {
  const { t } = useLocale();
  const [draft, setDraft] = useState('');
  const [componentName, setComponentName] = useState('');
  const [state, setState] = useState({ status: 'loading', products: [] });
  const [attempt, setAttempt] = useState(0);
  const controller = useRef(null);

  const load = useCallback(async (filter) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => ({ ...previous, status: 'loading' }));
    try {
      const products = await catalogueApi.list({
        componentName: filter || undefined,
        signal: current.signal,
      });
      if (!current.signal.aborted)
        setState({
          status: 'ready',
          products: Array.isArray(products) ? products : [],
        });
    } catch (error) {
      if (!current.signal.aborted && error?.kind !== 'aborted')
        setState({
          status: 'error',
          products: [],
          error: apiMessageKey(error, 'catalogueLoadFailed'),
        });
    }
  }, []);

  useEffect(() => {
    void load(componentName);
    return () => controller.current?.abort();
  }, [componentName, attempt, load]);

  function search(event) {
    event.preventDefault();
    setComponentName(draft.trim());
  }

  function clear() {
    setDraft('');
    setComponentName('');
  }

  const { status, products, error } = state;
  return (
    <section className="catalogue" aria-labelledby="catalogue-title">
      <h1 id="catalogue-title">{t('catalogue')}</h1>
      <p className="intro">{t('catalogueIntro')}</p>

      <form className="catalogue-search" role="search" onSubmit={search}>
        <label htmlFor="catalogue-component">{t('searchByComponent')}</label>
        <div className="catalogue-search__row">
          <input
            id="catalogue-component"
            type="search"
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button className="button button--primary" type="submit">
            {t('search')}
          </button>
          {componentName && (
            <button
              className="button button--secondary"
              type="button"
              onClick={clear}
            >
              {t('clearSearch')}
            </button>
          )}
        </div>
      </form>

      {status === 'loading' && <LoadingState labelKey="loadingCatalogue" />}

      {status === 'error' && (
        <div>
          <FeedbackMessage severity="error" messageKey={error} />
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('retry')}
          </button>
        </div>
      )}

      {status === 'ready' && products.length === 0 && (
        <EmptyState
          titleKey={componentName ? 'catalogueNoMatch' : 'catalogueEmpty'}
          values={componentName ? { name: componentName } : undefined}
        />
      )}

      {status === 'ready' && products.length > 0 && (
        <ul className="catalogue-list">
          {products.map((product) => (
            <li key={product.id} className="catalogue-item">
              <div className="catalogue-item__header">
                <h2>
                  <Link to={`/catalogue/${encodeURIComponent(product.id)}`}>
                    {product.name}
                  </Link>
                </h2>
                <span className="catalogue-item__price">
                  <ProductPrice product={product} />
                </span>
              </div>
              <p className="catalogue-item__meta">
                <span className="tag">{product.category?.name}</span>
                <AvailabilityTag available={product.available} />
              </p>
              {product.description && <p>{product.description}</p>}
              <AllergenList allergens={product.allergens} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
