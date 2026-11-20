import { createManagementModule } from '../createManagementModule.jsx';
import { createStockApi } from './stockApi.js';
import StockPage from './StockPage.jsx';
export default createManagementModule(createStockApi, StockPage);
