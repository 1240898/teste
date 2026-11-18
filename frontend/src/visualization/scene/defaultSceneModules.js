import { createBaseLightingModule } from './modules/BaseLightingModule.js';
import { createKitchenLayoutModule } from './modules/KitchenLayoutModule.js';

/**
 * Scene modules of the kitchen viewer, in build order. The kitchen layout
 * (VIS02) comes first so that the room exists when later modules are built:
 * VIS03 assembly line, VIS05 / VIS06 lighting, VIS07 camera controls.
 */
export const defaultSceneModules = Object.freeze([
  createKitchenLayoutModule,
  createBaseLightingModule,
]);