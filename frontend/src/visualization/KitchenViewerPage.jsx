import { useAuth } from '../features/authentication/state/authContext.js';
import { createLightControlsModule } from './scene/modules/LightControlsModule.js';
import { defaultSceneModules } from './scene/defaultSceneModules.js';
import KitchenViewer from './viewer/KitchenViewer.jsx';

export default function KitchenViewerPage({ request }) {
  const { hasAnyRole } = useAuth();
  return (
    <KitchenViewer
      request={request}
      modules={defaultSceneModules}
      canEditLights={hasAnyRole('MANAGER')}
      createLightControls={createLightControlsModule}
    />
  );
}
