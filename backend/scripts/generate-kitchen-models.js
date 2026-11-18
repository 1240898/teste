/**
 * VIS02 - (re)writes the team-made kitchen equipment models of
 * scripts/kitchen-models into assets/kitchen/files. The output is
 * deterministic, so running it again gives byte-identical files.
 *
 *   npm run kitchen:models
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readKitchenAssetManifest } from '../src/modules/kitchen-configuration-management/infrastructure/seedKitchenAssets.js';
import { DEFAULT_ASSETS_DIRECTORY } from '../src/modules/kitchen-configuration-management/infrastructure/files/LocalKitchenAssetFileStore.js';
import { KITCHEN_MODELS, kitchenModelGlb } from './kitchen-models/index.js';

const entries = await readKitchenAssetManifest();
const root = path.resolve(DEFAULT_ASSETS_DIRECTORY);
let written = 0;
for (const id of Object.keys(KITCHEN_MODELS)) {
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`${id} is not in the asset manifest.`);
  const target = path.resolve(root, entry.path);
  if (!target.startsWith(root + path.sep))
    throw new Error(`Unsafe asset path: ${entry.path}`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, kitchenModelGlb(id));
  written += 1;
}
console.log(`Kitchen models: ${written} file(s) written.`);