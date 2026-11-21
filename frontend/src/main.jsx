import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import './styles/index.css';

// WEB01 module slot (moduleRoutes ids): a real dynamic import per module. A
// section is enabled and routable only once its loader is registered here.
const modules = {
  planning: () => import('./features/planning/PlanningPage.jsx'),
  kitchenViewer: () => import('./visualization/KitchenViewerPage.jsx'),
  // WEB06 (ALN-3): /kitchen/configurations, /new and /:configurationId (MANAGER).
  kitchenConfigurations: () =>
    import('./features/kitchen-configurations/KitchenConfigurationsModule.jsx'),
  customers: () =>
    import('./features/business-management/customers/CustomersModule.jsx'),
  categories: () =>
    import('./features/business-management/categories/CategoriesModule.jsx'),
  allergens: () =>
    import('./features/business-management/allergens/AllergensModule.jsx'),
  products: () =>
    import('./features/business-management/products/ProductsModule.jsx'),
  pizzaSizes: () =>
    import('./features/business-management/pizza-sizes/PizzaSizesModule.jsx'),
  componentTypes: () =>
    import('./features/business-management/component-types/ComponentTypesModule.jsx'),
  predefinedPizzas: () =>
    import('./features/business-management/predefined-pizzas/PredefinedPizzasModule.jsx'),
  stock: () => import('./features/business-management/stock/StockModule.jsx'),
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App modules={modules} />
  </StrictMode>,
);
