import { createManagementModule } from '../createManagementModule.jsx';
import { createPizzaSizeApi } from './pizzaSizeApi.js';
import PizzaSizesPage from './PizzaSizesPage.jsx';
export default createManagementModule(createPizzaSizeApi, PizzaSizesPage);
