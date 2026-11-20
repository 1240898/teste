import { createManagementModule } from '../createManagementModule.jsx';
import { createAllergenApi } from './allergenApi.js';
import AllergensPage from './AllergensPage.jsx';
export default createManagementModule(createAllergenApi, AllergensPage);
