import { buildGlb } from './glb.js';
import { KITCHEN_MODELS } from './models.js';

export { buildGlb } from './glb.js';
export { KITCHEN_MODELS } from './models.js';

/** GLB content of a kitchen equipment model, or undefined for other ids. */
export function kitchenModelGlb(assetId) {
  const recipe = KITCHEN_MODELS[assetId];
  return recipe && buildGlb(recipe);
}