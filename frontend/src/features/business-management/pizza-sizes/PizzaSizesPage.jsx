import ManagementWorkspace from '../../../shared/feedback/ManagementWorkspace.jsx';
import { pizzaSizeToForm, pizzaSizeToPayload } from './pizzaSizeDTO.js';
const config = {
  titleKey: 'pizzaSizes',
  idKey: 'id',
  canCreate: true,
  canEdit: true,
  fields: [{ name: 'name', labelKey: 'name', required: true }],
  toForm: pizzaSizeToForm,
  toPayload: pizzaSizeToPayload,
  filterFields: [
    { name: 'name', labelKey: 'name' },
    {
      name: 'active',
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
    {
      key: 'active',
      labelKey: 'managementStatus',
      render: (item, _records, t) => t(item.active ? 'active' : 'inactive'),
    },
  ],
  rowActions: [
    {
      key: 'activate',
      labelKey: 'managementActivate',
      show: (item) => !item.active,
      confirmKey: 'managementConfirmStatus',
      run: (api, item) => api.update(item.id, { active: true }),
    },
    {
      key: 'deactivate',
      labelKey: 'managementDeactivate',
      show: (item) => item.active,
      confirmKey: 'managementConfirmStatus',
      run: (api, item) => api.update(item.id, { active: false }),
    },
  ],
};
export default function PizzaSizesPage({ api }) {
  return <ManagementWorkspace config={config} api={api} />;
}
