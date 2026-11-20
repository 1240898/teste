import ManagementWorkspace from '../../../shared/feedback/ManagementWorkspace.jsx';
import { componentTypeLabel } from '../../../shared/locale/businessReferenceLabels.js';
import { componentTypeToPayload } from './componentTypeDTO.js';
const config = {
  titleKey: 'componentTypes',
  introKey: 'componentTypeLimitsHelp',
  idKey: 'id',
  canCreate: true,
  canEdit: true,
  fields: [
    { name: 'name', labelKey: 'name', required: true },
    {
      name: 'assemblyOrder',
      labelKey: 'assemblyOrder',
      type: 'number',
      min: 1,
      required: true,
    },
    {
      name: 'minQuantity',
      labelKey: 'minimumQuantity',
      type: 'number',
      min: 0,
      required: true,
    },
    {
      name: 'maxQuantity',
      labelKey: 'maximumQuantity',
      type: 'number',
      min: 0,
      nullable: true,
    },
  ],
  toPayload: componentTypeToPayload,
  filterFields: [{ name: 'name', labelKey: 'name' }],
  columns: [
    { key: 'id', labelKey: 'identifier' },
    {
      key: 'name',
      labelKey: 'name',
      render: (item, _records, t) => componentTypeLabel(item, t),
    },
    { key: 'assemblyOrder', labelKey: 'assemblyOrder' },
    { key: 'minQuantity', labelKey: 'minimumQuantity' },
    { key: 'maxQuantity', labelKey: 'maximumQuantity' },
  ],
  rowActions: [
    {
      key: 'remove',
      labelKey: 'delete',
      danger: true,
      confirmKey: 'managementConfirmDelete',
      run: (api, item) => api.remove(item.id),
    },
  ],
};
export default function ComponentTypesPage({ api }) {
  return <ManagementWorkspace config={config} api={api} />;
}
