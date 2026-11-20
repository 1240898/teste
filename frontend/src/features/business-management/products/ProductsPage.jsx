import ManagementWorkspace from '../../../shared/feedback/ManagementWorkspace.jsx';
import { useLocation, useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { useAuth } from '../../authentication/state/authContext.js';
import FeedbackMessage from '../../../shared/feedback/FeedbackMessage.jsx';
import { useLocale } from '../../../shared/locale/localeContext.js';
import { allergenLabel } from '../../../shared/locale/allergenLabels.js';
import {
  categoryLabel,
  componentTypeLabel,
} from '../../../shared/locale/businessReferenceLabels.js';
import { productToForm, productToPayload } from './productDTO.js';
const EU_ALLERGEN_IDS = Array.from({ length: 14 }, (_, index) => index + 1);

const fields = (
  categories,
  componentTypes,
  allergens,
  compositionProducts,
  refreshCompositionProducts,
  compositionProductsLoading,
  t,
) => [
  { name: 'name', labelKey: 'name', required: true },
  { name: 'description', labelKey: 'description', required: true },
  {
    name: 'categoryId',
    labelKey: 'categoryId',
    type: 'select',
    required: true,
    options: categories.map((category) => ({
      value: category.id,
      label: `${categoryLabel(category, t)} (${category.id})`,
    })),
  },
  { name: 'isSellable', labelKey: 'isSellable', type: 'boolean' },
  { name: 'isPizzaComponent', labelKey: 'isPizzaComponent', type: 'boolean' },
  {
    name: 'acquisitionType',
    labelKey: 'acquisitionType',
    type: 'select',
    required: true,
    options: [
      { value: 'PURCHASED', labelKey: 'purchased' },
      { value: 'PRODUCED', labelKey: 'produced' },
    ],
  },
  {
    name: 'compositionItems',
    labelKey: 'compositionItems',
    type: 'composition',
    helpKey: 'compositionSelectionHelp',
    addLabelKey: 'addCompositionProduct',
    removeLabelKey: 'removeCompositionProduct',
    emptyOptionsKey: 'noCompositionProducts',
    refreshLabelKey: 'refreshCompositionProducts',
    optionsLoading: compositionProductsLoading,
    onRefreshOptions: refreshCompositionProducts,
    initial: [],
    options: compositionProducts.map((product) => ({
      value: product.id,
      label: `${product.name} (${product.id})`,
    })),
  },
  {
    name: 'pizzaComponentTypeId',
    labelKey: 'componentTypeId',
    type: 'select',
    nullable: true,
    options: componentTypes.map((type) => ({
      value: type.id,
      label: `${componentTypeLabel(type, t)} (${type.id})`,
    })),
  },
  {
    name: 'allergenIds',
    labelKey: 'allergenIds',
    type: 'checkboxGroup',
    options: EU_ALLERGEN_IDS.map((id) => {
      const allergen = allergens.find((item) => Number(item.id) === id);
      return {
        value: String(id),
        label: allergenLabel(id, allergen?.name, t),
      };
    }),
  },
  {
    name: 'pricingMode',
    labelKey: 'pricingMode',
    type: 'select',
    options: [
      { value: 'FIXED', labelKey: 'fixedPrice' },
      { value: 'COMPONENT_BASED', labelKey: 'componentBasedPrice' },
    ],
  },
  {
    name: 'basePrice',
    labelKey: 'basePrice',
    type: 'number',
    min: 0,
    step: '0.01',
    nullable: true,
  },
];
const config = {
  titleKey: 'products',
  idKey: 'id',
  canCreate: true,
  canEdit: true,
  fields: [],
  toForm: productToForm,
  toPayload: productToPayload,
  versionField: 'expectedUpdatedAt',
  filterFields: [
    { name: 'name', labelKey: 'name' },
    { name: 'categoryId', labelKey: 'categoryId' },
    {
      name: 'isActive',
      labelKey: 'managementStatus',
      type: 'select',
      options: [
        { value: 'true', labelKey: 'active' },
        { value: 'false', labelKey: 'inactive' },
      ],
    },
  ],
  columns: [
    { key: 'id', labelKey: 'identifier' },
    { key: 'name', labelKey: 'name' },
    { key: 'categoryId', labelKey: 'categoryId' },
    {
      key: 'isActive',
      labelKey: 'managementStatus',
      render: (item, _records, t) =>
        item.isActive ? t('active') : t('inactive'),
    },
    {
      key: 'allergens',
      labelKey: 'allergens',
      render: (item, _records, t) =>
        `${t('directAllergens')}: ${(item.allergenIds ?? []).join(', ') || '—'}; ${t('derivedAllergens')}: ${(item.derivedAllergenIds ?? []).join(', ') || '—'}`,
    },
  ],
  detailFields: [
    { key: 'id', labelKey: 'identifier' },
    { key: 'name', labelKey: 'name' },
    { key: 'description', labelKey: 'description' },
    { key: 'categoryId', labelKey: 'categoryId' },
    { key: 'isSellable', labelKey: 'isSellable' },
    { key: 'isPizzaComponent', labelKey: 'isPizzaComponent' },
    { key: 'acquisitionType', labelKey: 'acquisitionType' },
    { key: 'compositionItems', labelKey: 'compositionItems' },
    { key: 'pizzaComponentTypeId', labelKey: 'componentTypeId' },
    {
      key: 'allergens',
      labelKey: 'allergens',
      render: (item, _records, t) =>
        `${t('directAllergens')}: ${(item.allergenIds ?? []).join(', ') || '—'}; ${t('derivedAllergens')}: ${(item.derivedAllergenIds ?? []).join(', ') || '—'}`,
    },
    { key: 'pricingMode', labelKey: 'pricingMode' },
    { key: 'basePrice', labelKey: 'basePrice' },
    { key: 'isActive', labelKey: 'managementStatus' },
  ],
  rowActions: [
    {
      key: 'configurations',
      labelKey: 'componentConfigurations',
      show: (item) => item.isPizzaComponent,
      to: (item) =>
        `/manage/products/${encodeURIComponent(item.id)}/component-configurations`,
    },
    {
      key: 'activate',
      labelKey: 'managementActivate',
      show: (item) => !item.isActive,
      run: (api, item) => api.activate(item.id),
    },
    {
      key: 'deactivate',
      labelKey: 'managementDeactivate',
      show: (item) => item.isActive,
      run: (api, item) => api.deactivate(item.id),
    },
  ],
};
export default function ProductsPage({ api }) {
  const { pathname } = useLocation();
  const { productId } = useParams();
  const auth = useAuth();
  const { t } = useLocale();
  const isManager = auth.hasAnyRole('MANAGER');
  const [categories, setCategories] = useState([]);
  const [componentTypes, setComponentTypes] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [compositionProducts, setCompositionProducts] = useState([]);
  const [compositionProductsLoading, setCompositionProductsLoading] =
    useState(false);
  const [referencesFailed, setReferencesFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const requests = [
      api.listCategories(controller.signal),
      api.listAllergens(controller.signal),
      api.listCompositionProducts
        ? api.listCompositionProducts(controller.signal)
        : api.list({ isPizzaComponent: 'true', isActive: 'true' }, controller.signal),
    ];
    if (isManager) requests.push(api.listComponentTypes(controller.signal));
    Promise.all(requests)
      .then(([categoryList, allergenList, componentList, typeList = []]) => {
        setCategories(categoryList ?? []);
        setAllergens(allergenList ?? []);
        setCompositionProducts(componentList ?? []);
        setComponentTypes(typeList ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setReferencesFailed(true);
      });
    return () => controller.abort();
  }, [api, isManager]);
  const refreshCompositionProducts = async () => {
    setCompositionProductsLoading(true);
    try {
      const result = api.listCompositionProducts
        ? await api.listCompositionProducts()
        : await api.list({ isPizzaComponent: 'true', isActive: 'true' });
      setCompositionProducts(result ?? []);
    } catch {
      setReferencesFailed(true);
    } finally {
      setCompositionProductsLoading(false);
    }
  };
  const productFields = fields(
    categories,
    componentTypes,
    allergens,
    compositionProducts.filter((product) => product.id !== productId),
    refreshCompositionProducts,
    compositionProductsLoading,
    t,
  );
  const allergenNames = (ids = []) =>
    ids.length
      ? ids
          .map((id) => {
            const reference = allergens.find(
              (allergen) => Number(allergen.id) === Number(id),
            );
            return allergenLabel(id, reference?.name, t);
          })
          .join(', ')
      : '—';
  const pageConfigWithReferences = {
    ...config,
    fields: productFields,
    filterFields: [
      ...config.filterFields,
      {
        name: 'excludeAllergenIds',
        labelKey: 'excludeAllergens',
        type: 'checkboxGroup',
        options: EU_ALLERGEN_IDS.map((id) => ({
          value: String(id),
          label: allergenLabel(
            id,
            allergens.find((allergen) => Number(allergen.id) === id)?.name,
            t,
          ),
        })),
      },
    ],
    columns: config.columns.map((column) =>
      column.key === 'allergens'
        ? {
            ...column,
            render: (item) =>
              `${t('directAllergens')}: ${allergenNames(item.allergenIds)}; ${t('derivedAllergens')}: ${allergenNames(item.derivedAllergenIds)}`,
          }
        : column,
    ),
    detailFields: config.detailFields.map((field) =>
      field.key === 'allergens'
        ? {
            ...field,
            render: (item) =>
              `${t('directAllergens')}: ${allergenNames(item.allergenIds)}; ${t('derivedAllergens')}: ${allergenNames(item.derivedAllergenIds)}`,
          }
        : field,
    ),
  };
  const pageConfig = pathname.endsWith('/new')
    ? { ...pageConfigWithReferences, initialAction: 'create' }
    : productId
      ? {
          ...pageConfigWithReferences,
          initialAction: 'edit',
          initialRecordId: productId,
        }
      : pageConfigWithReferences;
  return (
    <>
      {referencesFailed && (
        <FeedbackMessage severity="error" messageKey="referenceDataFailed" />
      )}
      <ManagementWorkspace config={pageConfig} api={api} />
    </>
  );
}
