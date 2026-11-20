import ManagementWorkspace from '../../../shared/feedback/ManagementWorkspace.jsx';
import { categoryLabel } from '../../../shared/locale/businessReferenceLabels.js';
import { categoryToPayload } from './categoryDTO.js';
const config = {
  titleKey: 'categories',
  idKey: 'id',
  canCreate: true,
  canEdit: true,
  fields: [{ name: 'name', labelKey: 'name', required: true }],
  toPayload: categoryToPayload,
  filterFields: [{ name: 'name', labelKey: 'name' }],
  columns: [
    { key: 'id', labelKey: 'identifier' },
    {
      key: 'name',
      labelKey: 'name',
      render: (item, _records, t) => categoryLabel(item, t),
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
export default function CategoriesPage({ api }) {
  return <ManagementWorkspace config={config} api={api} />;
}
