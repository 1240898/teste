import { createManagementModule } from '../createManagementModule.jsx';
import { createCategoryApi } from './categoryApi.js';
import CategoriesPage from './CategoriesPage.jsx';
export default createManagementModule(createCategoryApi, CategoriesPage);
