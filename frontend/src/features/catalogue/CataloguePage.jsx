
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
import { allergenLabel } from '../../shared/locale/allergenLabels.js';

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
 * every role, Guest included. Component and allergen filters are serialized
 * by the public catalogue adapter; management pages stay with WEB05.
 */
export default function CataloguePage() {
  const { t } = useLocale();
  const [filters, setFilters] = useState({
    componentIds: [],
    excludeComponentIds: [],
    excludeAllergenIds: [],
  });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [filterOptions, setFilterOptions] = useState({
    components: [],
    allergens: [],
  });
  const [state, setState] = useState({ status: 'loading', products: [] });
  const [attempt, setAttempt] = useState(0);
  const controller = useRef(null);

  const load = useCallback(async (selectedFilters) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => ({ ...previous, status: 'loading' }));
    try {
      const products = await catalogueApi.list({
        ...selectedFilters,
        signal: current.signal,
      });
      if (!current.signal.aborted) {
        setState({
          status: 'ready',
          products: Array.isArray(products) ? products : [],
        });
        if (
          !selectedFilters.componentIds.length &&
          !selectedFilters.excludeComponentIds.length &&
          !selectedFilters.excludeAllergenIds.length
        ) {
          const components = new Map();
          const allergens = new Map();
          for (const product of products ?? []) {
            for (const component of product.pizza?.defaultComponents ?? [])
              components.set(component.id, component);
            // Components sold on their own, even if no pizza recipe uses them.
            if (product.isPizzaComponent)
              components.set(product.id, { id: product.id, name: product.name });
            for (const allergen of product.allergens ?? [])
              allergens.set(allergen.id, allergen);
          }
          setFilterOptions({
            components: [...components.values()].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
            allergens: [...allergens.values()].sort((a, b) => a.id - b.id),
          });
        }
      }
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
    void load(filters);
    return () => controller.current?.abort();
  }, [filters, attempt, load]);

  function search(event) {
    event.preventDefault();
    setFilters(draftFilters);
  }

  function clear() {
    const empty = {
      componentIds: [],
      excludeComponentIds: [],
      excludeAllergenIds: [],
    };
    setDraftFilters(empty);
    setFilters(empty);
  }

  const { status, products, error } = state;
  const updateSelection = (name, event) =>
    setDraftFilters((current) => ({
      ...current,
      [name]: [...event.target.selectedOptions].map((option) => option.value),
    }));
  const hasFilters = Object.values(filters).some((values) => values.length > 0);
  return (
    <section className="catalogue" aria-labelledby="catalogue-title">
      <h1 id="catalogue-title">{t('catalogue')}</h1>
      <p className="intro">{t('catalogueIntro')}</p>

      <form className="catalogue-search" role="search" onSubmit={search}>
        <div className="catalogue-search__row">
          <label htmlFor="catalogue-components">{t('searchByComponent')}</label>
          <select
            id="catalogue-components"
            multiple
            value={draftFilters.componentIds}
            onChange={(event) => updateSelection('componentIds', event)}
          >
            {filterOptions.components.map((component) => (
              <option key={component.id} value={component.id}>
                {component.name} ({component.id})
              </option>
            ))}
          </select>
          <span>{t('componentFilterHelp')}</span>
          <label htmlFor="catalogue-exclude-components">{t('excludeComponents')}</label>
          <select
            id="catalogue-exclude-components"
            multiple
            value={draftFilters.excludeComponentIds}
            onChange={(event) => updateSelection('excludeComponentIds', event)}
          >
            {filterOptions.components.map((component) => (
              <option key={component.id} value={component.id}>
                {component.name} ({component.id})
              </option>
            ))}
          </select>
          <label htmlFor="catalogue-exclude-allergens">{t('excludeAllergens')}</label>
          <select
            id="catalogue-exclude-allergens"
            multiple
            value={draftFilters.excludeAllergenIds}
            onChange={(event) => updateSelection('excludeAllergenIds', event)}
          >
            {filterOptions.allergens.map((allergen) => (
              <option key={allergen.id} value={String(allergen.id)}>
                {allergenLabel(allergen.id, allergen.name, t)}
              </option>
            ))}
          </select>
          <button className="button button--primary" type="submit">
            {t('search')}
          </button>
          {hasFilters && (
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
          titleKey={hasFilters ? 'catalogueNoFilterMatch' : 'catalogueEmpty'}
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
