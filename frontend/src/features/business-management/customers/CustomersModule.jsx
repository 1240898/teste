import { createManagementModule } from '../createManagementModule.jsx';
import { createCustomerApi } from './customerApi.js';
import CustomersPage from './CustomersPage.jsx';
export default createManagementModule(createCustomerApi, CustomersPage);
