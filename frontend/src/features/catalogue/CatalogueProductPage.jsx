import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useLocale } from '../../shared/locale/localeContext.js';
import { apiMessageKey } from '../../shared/locale/messageKeys.js';
import { catalogueApi } from './catalogueApi.js';
import { formatPrice } from './catalogueFormat.js';
import { AllergenList, AvailabilityTag } from './CatalogueParts.jsx';
import FeedbackMessage from '../../shared/feedback/FeedbackMessage.jsx';
import LoadingState from '../../shared/feedback/LoadingState.jsx';

// Same format the back end validates (BCK11): anything else is not requested.
const PRODUCT_ID = /^PROD-\d{5,}$/i;

function SizeTable({ sizes }) {
  const { locale, t } = useLocale();
  return (
    <table className="catalogue-sizes">
      <caption>{t('sizesAndPrices')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('size')}</th>
          <th scope="col">{t('price')}</th>
          <th scope="col">{t('availability')}</th>
        </tr>
      </thead>
      <tbody>
        {sizes.map((size) => (
          <tr key={size.sizeId}>
            <th scope="row">{size.sizeName}</th>
            <td>{formatPrice(size.price, locale)}</td>
            <td>{t(size.available ? 'available' : 'unavailable')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** WEB03 (BR 4): public product and allergen information (catalogue detail). */
export default function CatalogueProductPage() {
  const { productId } = useParams();
  const { locale, t } = useLocale();
  const valid = PRODUCT_ID.test(productId ?? '');
  const [state, setState] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!valid) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading' });
    catalogueApi
      .get(productId, { signal: controller.signal })
      .then((product) => {
        if (!controller.signal.aborted) setState({ status: 'ready', product });
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.kind === 'aborted') return;
        setState(
          error?.status === 404 || error?.status === 400
            ? { status: 'missing' }
            : {
                status: 'error',
                error: apiMessageKey(error, 'catalogueLoadFailed'),
              },
        );
      });
    return () => controller.abort();
  }, [productId, valid, attempt]);

  const status = valid ? state.status : 'missing';
  const back = (
    <Link className="text-button catalogue-back" to="/catalogue">
      {t('backToCatalogue')}
    </Link>
  );

  if (status === 'loading')
    return (
      <section className="catalogue">
        <h1>{t('productDetails')}</h1>
        <LoadingState labelKey="loadingCatalogue" />
      </section>
    );

  if (status === 'missing')
    return (
      <section className="catalogue">
        <h1>{t('productDetails')}</h1>
        <p className="feedback" role="status">
          {t('productUnavailable')}
        </p>
        {back}
      </section>
    );

  if (status === 'error')
    return (
      <section className="catalogue">
        <h1>{t('productDetails')}</h1>
        <FeedbackMessage severity="error" messageKey={state.error} />
        <button
          className="button button--secondary"
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          {t('retry')}
        </button>
        {back}
      </section>
    );

  const { product } = state;
  return (
    <article className="catalogue" aria-labelledby="product-title">
      {back}
      <h1 id="product-title">{product.name}</h1>
      <p className="catalogue-item__meta">
        <span className="tag">{product.category?.name}</span>
        <AvailabilityTag available={product.available} />
      </p>
      {product.description && <p>{product.description}</p>}
      {product.pizza ? (
        <>
          {product.pizza.sizes.length > 0 ? (
            <SizeTable sizes={product.pizza.sizes} />
          ) : (
            <p className="feedback">{t('noSizeAvailable')}</p>
          )}
          {product.pizza.defaultComponents.length > 0 && (
            <>
              <h2>{t('defaultComponents')}</h2>
              <ul className="catalogue-components">
                {product.pizza.defaultComponents.map((component) => (
                  <li key={component.id}>{component.name}</li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className="catalogue-item__price">
          {formatPrice(product.price, locale)}
        </p>
      )}
      <h2>{t('allergens')}</h2>
      <AllergenList allergens={product.allergens} showLabel={false} />
    </article>
  );
}
