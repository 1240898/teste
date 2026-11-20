import { createManagementModule } from '../createManagementModule.jsx';
import { createComponentConfigurationApi } from './componentConfigurationApi.js';
import ComponentConfigurationsPage from './ComponentConfigurationsPage.jsx';
import RequireRole from '../../../app/navigation/RequireRole.jsx';
import FeedbackMessage from '../../../shared/feedback/FeedbackMessage.jsx';
const BaseModule = createManagementModule(
  createComponentConfigurationApi,
  ComponentConfigurationsPage,
);
export default function ComponentConfigurationsModule({ request }) {
  return (
    <RequireRole
      roles={['MANAGER']}
      fallback={
        <FeedbackMessage severity="error" messageKey="insufficientPermission" />
      }
    >
      <BaseModule request={request} />
    </RequireRole>
  );
}
