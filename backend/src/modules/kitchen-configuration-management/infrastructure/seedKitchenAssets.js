import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GltfModelInspector } from './files/GltfModelInspector.js';
import { LocalKitchenAssetFileStore } from './files/LocalKitchenAssetFileStore.js';

export const DEFAULT_MANIFEST = fileURLToPath(
  new URL('../../../../assets/kitchen/manifest.json', import.meta.url),
);

const ID = /^AST-[A-Z0-9-]{1,60}$/;
const KINDS = ['MODEL', 'TEXTURE'];

export async function readKitchenAssetManifest(file = DEFAULT_MANIFEST) {
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(manifest?.assets))
    throw new Error('The kitchen asset manifest must have an "assets" array');
  return manifest.assets;
}

/**
 * Loads the read-only kitchen asset catalogue (D8) into kitchen_assets.
 * Idempotent (INSERT ... ON CONFLICT (id) DO UPDATE) and never deletes.
 * Fails - so the caller's transaction rolls back - when an entry has no file in
 * the asset store or a model is not glTF / GLB. Model sizes and
 * embeddedTextureSet are computed by GltfModelInspector (D19, D20).
 */
export async function seedKitchenAssets(
  tx,
  entries,
  {
    files = new LocalKitchenAssetFileStore(),
    inspector = new GltfModelInspector(),
  } = {},
) {
  let inserted = 0;
  let updated = 0;
  for (const entry of entries) {
    const { id, kind, format, path, description = '' } = entry ?? {};
    if (!ID.test(id ?? '') || !KINDS.includes(kind))
      throw new Error(`Invalid kitchen asset manifest entry: ${id}`);
    if (!(await files.exists(path)))
      throw new Error(`Kitchen asset file not found for ${id}: ${path}`);
    let size = null;
    let embeddedTextureSet = null;
    if (kind === 'MODEL') {
      if (!['glb', 'gltf'].includes(format))
        throw new Error(`Kitchen model ${id} must be glTF / GLB`);
      ({ size, embeddedTextureSet } = await inspector.inspect(
        files.resolve(path),
      ));
    }
    const { rows } = await tx.query(
      `INSERT INTO kitchen_assets
         (id, kind, format, path, description, size_x, size_y, size_z, embedded_texture_set)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         kind = EXCLUDED.kind, format = EXCLUDED.format, path = EXCLUDED.path,
         description = EXCLUDED.description, size_x = EXCLUDED.size_x,
         size_y = EXCLUDED.size_y, size_z = EXCLUDED.size_z,
         embedded_texture_set = EXCLUDED.embedded_texture_set
       RETURNING (xmax = 0) AS inserted`,
      [
        id,
        kind,
        format,
        path,
        String(description).trim().slice(0, 200),
        size?.x ?? null,
        size?.y ?? null,
        size?.z ?? null,
        embeddedTextureSet,
      ],
    );
    if (rows[0]?.inserted) inserted += 1;
    else updated += 1;
  }
  return { inserted, updated };
}