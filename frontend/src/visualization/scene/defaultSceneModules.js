import { createAssemblyLineModule } from './modules/AssemblyLineModule.js';
import { createCameraControlsModule } from './modules/CameraControlsModule.js';
import { createKitchenLayoutModule } from './modules/KitchenLayoutModule.js';
import { createKitchenLightingModule } from './modules/KitchenLightingModule.js';

// Fit the lighting to the complete kitchen before the camera sets its initial view.
export const defaultSceneModules = Object.freeze([
  createKitchenLayoutModule,
  createAssemblyLineModule,
  createKitchenLightingModule,
  createCameraControlsModule,
]);

// VIS07 stays last so its camera update sees the final scene state.
export function withLightControls(modules, controls) {
  const factories = [...modules];
  const camera = factories.indexOf(createCameraControlsModule);
  factories.splice(camera < 0 ? factories.length : camera, 0, () => controls);
  return factories;
}
