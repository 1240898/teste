import ManagementWorkspace from '../../../shared/feedback/ManagementWorkspace.jsx';
import { useParams } from 'react-router';
import { useEffect, useState } from 'react';
import FeedbackMessage from '../../../shared/feedback/FeedbackMessage.jsx';
import {
  componentConfigurationToForm,
  componentConfigurationToPayload,
} from './componentConfigurationDTO.js';
const fields = (products, sizes) => [
  {
    name: 'productId',
    labelKey: 'productId',
    type: 'select',
    required: true,
    options: products.map((product) => ({
      value: product.id,
      label: `${product.name} (${product.id})`,
    })),
  },
  {
    name: 'sizeId',
    labelKey: 'pizzaSizeId',
    type: 'select',
    required: true,
    options: sizes.map((size) => ({
      value: size.id,
      label: `${size.name} (${size.id})`,
    })),
  },
  { name: 'amount', labelKey: 'configurationPrice', required: true },
  { name: 'currency', labelKey: 'currency', required: true },
  {
    name: 'stockUnitsConsumed',
    labelKey: 'stockUnitsConsumed',
    type: 'number',
    min: 0,
    nullable: true,
  },
];
const config = {
  titleKey: 'componentConfigurations',
  idKey: 'sizeId',
  getId: (item) => `${item.productId}|${item.sizeId}`,
  canCreate: true,
  canEdit: true,
  fields,
  toForm: componentConfigurationToForm,
  toPayload: componentConfigurationToPayload,
  filterFields: [{ name: 'productId', labelKey: 'productId' }],
  columns: [
    { key: 'productId', labelKey: 'productId' },
    { key: 'sizeId', labelKey: 'pizzaSizeId' },
    { key: 'amount', labelKey: 'configurationPrice' },
    { key: 'currency', labelKey: 'currency' },
    { key: 'stockUnitsConsumed', labelKey: 'stockUnitsConsumed' },
  ],
};
export default function ComponentConfigurationsPage({ api }) {
  const { productId } = useParams();
  const [products, setProducts] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [referencesFailed, setReferencesFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.listProducts(controller.signal),
      api.listSizes(controller.signal),
    ])
      .then(([productList, sizeList]) => {
        setProducts(productList ?? []);
        setSizes(sizeList ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setReferencesFailed(true);
      });
    return () => controller.abort();
  }, [api]);
  const featureFields = fields(products, sizes);
  const pageConfig = productId
    ? {
        ...config,
        initialFilters: { productId },
        fields: featureFields.map((field) =>
          field.name === 'productId' ? { ...field, initial: productId } : field,
        ),
      }
    : { ...config, fields: featureFields };
  return (
    <>
      {referencesFailed && (
        <FeedbackMessage severity="error" messageKey="referenceDataFailed" />
      )}
      <ManagementWorkspace config={pageConfig} api={api} />
    </>
  );
}
