import ManagementWorkspace from '../../../shared/feedback/ManagementWorkspace.jsx';
import { allergenLabel } from '../../../shared/locale/allergenLabels.js';
import { allergenToPayload } from './allergenDTO.js';
const config = {
  titleKey: 'allergens',
  idKey: 'id',
  canCreate: true,
  canEdit: true,
  fields: [
    {
      name: 'id',
      labelKey: 'allergenNumber',
      type: 'number',
      min: 1,
      max: 14,
      required: true,
    },
    { name: 'name', labelKey: 'name', required: true },
  ],
  toPayload: allergenToPayload,
  filterFields: [{ name: 'name', labelKey: 'name' }],
  columns: [
    { key: 'id', labelKey: 'identifier' },
    {
      key: 'name',
      labelKey: 'name',
      render: (item, _records, t) => allergenLabel(item.id, item.name, t),
    },
  ],
  rowActions: [
    {
      key: 'delete',
      labelKey: 'delete',
      danger: true,
      confirmKey: 'managementConfirmDelete',
      run: (api, item) => api.remove(item.id),
    },
  ],
};
export default function AllergensPage({ api }) {
  return <ManagementWorkspace config={config} api={api} />;
}
