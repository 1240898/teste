import { readFileSync } from 'node:fs';
import { ASSEMBLY_LINE_MODELS } from './assemblyLine.js';
import { buildGlb } from './glb.js';
import { KITCHEN_MODELS as EQUIPMENT_MODELS } from './models.js';

export { buildGlb } from './glb.js';
export const KITCHEN_MODELS = Object.freeze({
  ...EQUIPMENT_MODELS,
  ...ASSEMBLY_LINE_MODELS,
});

const textures = new URL(
  '../../assets/kitchen/files/textures/',
  import.meta.url,
);

/** GLB content of a kitchen model, or undefined for other ids. */
export function kitchenModelGlb(assetId) {
  const recipe = KITCHEN_MODELS[assetId];
  return (
    recipe && buildGlb(recipe, (file) => readFileSync(new URL(file, textures)))
  );
}
