import { createManagementModule } from '../createManagementModule.jsx';
import { createComponentTypeApi } from './componentTypeApi.js';
import ComponentTypesPage from './ComponentTypesPage.jsx';
export default createManagementModule(
  createComponentTypeApi,
  ComponentTypesPage,
);
