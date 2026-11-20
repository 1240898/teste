import ManagementWorkspace from '../../../shared/feedback/ManagementWorkspace.jsx';
import { stockAdjustmentToPayload, stockStartToPayload } from './stockDTO.js';
import { verifyStockAdjustment, verifyStockStart } from './stockOutcome.js';

const config = {
  titleKey: 'stock',
  idKey: 'productId',
  canCreate: true,
  createLabelKey: 'managementStartTracking',
  canEdit: false,
  fields: [
    { name: 'productId', labelKey: 'productId', required: true },
    { name: 'initialUnits', labelKey: 'initialUnits', type: 'number', min: 0 },
  ],
  toPayload: stockStartToPayload,
  // BR25: a start-tracking request with an unknown result is checked first.
  verifyCreate: verifyStockStart,
  filterFields: [
    { name: 'productId', labelKey: 'productId' },
    { name: 'productName', labelKey: 'name' },
    {
      name: 'historical',
      labelKey: 'historical',
      type: 'select',
      options: [
        { value: 'true', labelKey: 'yes' },
        { value: 'false', labelKey: 'no' },
      ],
    },
  ],
  columns: [
    { key: 'productId', labelKey: 'productId' },
    { key: 'productName', labelKey: 'name' },
    { key: 'availableUnits', labelKey: 'availableUnits' },
    { key: 'startedAt', labelKey: 'trackingStarted' },
    { key: 'endedAt', labelKey: 'trackingEnded' },
  ],
  rowActions: [
    {
      key: 'adjust',
      nonRepeatable: true,
      labelKey: 'managementAdjustStock',
      fields: [
        {
          name: 'direction',
          labelKey: 'adjustmentDirection',
          type: 'select',
          required: true,
          options: [
            { value: 'INCREASE', labelKey: 'stockIncrease' },
            { value: 'DECREASE', labelKey: 'stockDecrease' },
          ],
        },
        {
          name: 'units',
          labelKey: 'units',
          type: 'number',
          min: 1,
          required: true,
        },
      ],
      toPayload: stockAdjustmentToPayload,
      run: (api, item, payload) => api.adjust(item.productId, payload),
      show: (item) => !item.endedAt,
      // BR25: units before sending, compared with the API after a timeout.
      snapshot: (item) => item.availableUnits,
      verifyOutcome: verifyStockAdjustment,
      describe: (values) =>
        `${values.direction === 'DECREASE' ? '−' : '+'}${values.units}`,
    },
    {
      key: 'stop',
      labelKey: 'managementStopTracking',
      confirmKey: 'managementConfirmStatus',
      run: (api, item) => api.stop(item.productId),
      show: (item) => !item.endedAt,
    },
  ],
};

export default function StockPage({ api }) {
  return <ManagementWorkspace config={config} api={api} />;
}