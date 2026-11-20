import ManagementWorkspace from '../../../shared/feedback/ManagementWorkspace.jsx';
import { customerToForm, customerToPayload } from './customerDTO.js';
const fields = [
  { name: 'name', labelKey: 'name', required: true },
  { name: 'email', labelKey: 'email', type: 'email', required: true },
  { name: 'phoneNumber', labelKey: 'phoneNumber', required: true },
  { name: 'userId', labelKey: 'linkedUserId' },
  {
    name: 'dietaryRestrictions',
    labelKey: 'dietaryRestrictions',
    type: 'json',
    initial: '[]',
  },
];
const config = {
  titleKey: 'customers',
  idKey: 'id',
  canCreate: true,
  canEdit: true,
  fields,
  toPayload: customerToPayload,
  toForm: customerToForm,
  filterFields: [
    { name: 'name', labelKey: 'name' },
    { name: 'email', labelKey: 'email' },
    { name: 'phoneNumber', labelKey: 'phoneNumber' },
  ],
  columns: [
    { key: 'id', labelKey: 'identifier' },
    { key: 'name', labelKey: 'name' },
    { key: 'email', labelKey: 'email' },
    { key: 'phoneNumber', labelKey: 'phoneNumber' },
    {
      key: 'active',
      labelKey: 'managementStatus',
      render: (item, _records, t) => t(item.active ? 'active' : 'inactive'),
    },
  ],
  detailFields: [
    { key: 'id', labelKey: 'identifier' },
    { key: 'name', labelKey: 'name' },
    { key: 'email', labelKey: 'email' },
    { key: 'phoneNumber', labelKey: 'phoneNumber' },
    { key: 'userId', labelKey: 'linkedUserId' },
    { key: 'dietaryRestrictions', labelKey: 'dietaryRestrictions' },
    { key: 'active', labelKey: 'managementStatus' },
  ],
  rowActions: [
    {
      key: 'activate',
      labelKey: 'managementActivate',
      show: (item) => !item.active,
      run: (api, item) => api.activate(item.id),
    },
    {
      key: 'deactivate',
      labelKey: 'managementDeactivate',
      show: (item) => item.active,
      confirmKey: 'managementConfirmStatus',
      run: (api, item) => api.deactivate(item.id),
    },
  ],
};
export default function CustomersPage({ api }) {
  return <ManagementWorkspace config={config} api={api} />;
}
