import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import './styles/index.css';

// WEB01 module slot (moduleRoutes ids): a real dynamic import per module. A
// section is enabled and routable only once its loader is registered here.
const modules = {
  kitchenViewer: () => import('./visualization/KitchenViewerPage.jsx'),
  // WEB06 (ALN-3): /kitchen/configurations, /new and /:configurationId (MANAGER).
  kitchenConfigurations: () =>
    import('./features/kitchen-configurations/KitchenConfigurationsModule.jsx'),
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App modules={modules} />
  </StrictMode>,
);
