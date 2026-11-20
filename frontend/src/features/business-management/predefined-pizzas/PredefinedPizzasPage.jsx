
import ManagementWorkspace from '../../../shared/feedback/ManagementWorkspace.jsx';
import { useEffect, useState } from 'react';
import FeedbackMessage from '../../../shared/feedback/FeedbackMessage.jsx';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { allergenLabel } from '../../../shared/locale/allergenLabels.js';
import {
  componentsToPayload,
  predefinedPizzaToForm,
  predefinedPizzaToPayload,
} from './predefinedPizzaDTO.js';

// Why a pizza has no catalogue offer (see predefinedPizzaApi.list).
const OFFER_STATUS_KEYS = Object.freeze({
  error: 'catalogueLookupFailed',
  inactive: 'predefinedPizzaInactive',
  notSellable: 'predefinedPizzaNotSellable',
  notOffered: 'predefinedPizzaNotOffered',
  missing: 'predefinedPizzaProductMissing',
});

function getConfig(pizzaProducts, components, t) {
  const fields = [
    {
      name: 'productId',
      labelKey: 'productId',
      type: 'select',
      required: true,
      options: pizzaProducts.map((product) => ({
        value: product.id,
        label: `${product.name} (${product.id})`,
      })),
    },
    {
      name: 'componentIds',
      labelKey: 'componentIds',
      type: 'multiselect',
      required: true,
      options: components.map((product) => ({
        value: product.id,
        label: `${product.name} (${product.id})`,
      })),
    },
  ];
  return {
    titleKey: 'predefinedPizzas',
    idKey: 'id',
    canCreate: true,
    canEdit: false,
    fields,
    toForm: predefinedPizzaToForm,
    toPayload: predefinedPizzaToPayload,
    columns: [
      { key: 'id', labelKey: 'identifier' },
      {
        key: 'componentIds',
        labelKey: 'composition',
        render: (item) =>
          item.components?.map((component) => component.name).join(', ') ||
          (item.componentIds ?? []).join(', ') ||
          '—',
      },
      {
        key: 'offer',
        labelKey: 'sizesAndPrices',
        render: (item) => {
          const statusKey = OFFER_STATUS_KEYS[item.offerStatus];
          if (statusKey) return t(statusKey);
          const sizes = item.offer?.pizza?.sizes ?? [];
          return sizes.length
            ? sizes
                .map(
                  (size) =>
                    `${size.sizeName}: ${size.price?.amount} ${size.price?.currency} (${t(size.available ? 'available' : 'unavailable')})`,
                )
                .join('; ')
            : t('noSizeAvailable');
        },
      },
      {
        key: 'allergens',
        labelKey: 'allergens',
        render: (item) => {
          const ids = item.offer?.allergens?.length
            ? item.offer.allergens.map((allergen) => allergen.id)
            : [...new Set(
                (item.components ?? []).flatMap(
                  (component) => component.allergenIds ?? [],
                ),
              )];
          return ids.length
            ? ids.map((id) => allergenLabel(id, null, t)).join(', ')
            : t('noAllergens');
        },
      },
    ],
    rowActions: [
      {
        key: 'replace',
        labelKey: 'replaceConfiguration',
        fields: [fields[1]],
        toPayload: componentsToPayload,
        run: (api, item, body) => api.replace(item.id, body),
      },
    ],
  };
}
export default function PredefinedPizzasPage({ api }) {
  const { t } = useLocale();
  const [pizzaProducts, setPizzaProducts] = useState([]);
  const [components, setComponents] = useState([]);
  const [referenceError, setReferenceError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.listPizzaProducts(controller.signal),
      api.listComponents(controller.signal),
    ])
      .then(([pizzas, items]) => {
        setPizzaProducts(pizzas ?? []);
        setComponents(items ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setReferenceError(true);
      });
    return () => controller.abort();
  }, [api]);
  return (
    <>
      {referenceError && (
        <FeedbackMessage severity="error" messageKey="referenceDataFailed" />
      )}
      <ManagementWorkspace
        config={getConfig(pizzaProducts, components, t)}
        api={api}
      />
    </>
  );
}
