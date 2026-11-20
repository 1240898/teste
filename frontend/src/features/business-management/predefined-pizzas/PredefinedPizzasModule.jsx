import { createManagementModule } from '../createManagementModule.jsx';
import { createPredefinedPizzaApi } from './predefinedPizzaApi.js';
import PredefinedPizzasPage from './PredefinedPizzasPage.jsx';
export default createManagementModule(
  createPredefinedPizzaApi,
  PredefinedPizzasPage,
);
