import {
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { MaterialApplicationHelper } from './MaterialApplicationHelper.js';
import { DEFAULTS, MAP_KEYS, parse } from './MaterialParser.js';

// WEB06 MaterialProperties fields that reference preloaded textures, and the
// MeshStandardMaterial property each one fills (SGRAI W5 slides 165-170).
const MAP_FIELDS = Object.freeze({
  colorMapAssetId: 'map',
  roughnessMapAssetId: 'roughnessMap',
  normalMapAssetId: 'normalMap',
  bumpMapAssetId: 'bumpMap',
});

export class MissingTextureError extends Error {
  constructor(assetId) {
    super(`A preloaded kitchen texture is missing: ${assetId}`);
    this.name = 'MissingTextureError';
    this.assetId = assetId;
  }
}

/**
 * Material factory of the kitchen viewer (usVIS04, contract of VIS02 ALN-2):
 * create(properties, options), applyOverride(root, properties), dispose(release).
 *
 * VIS04 refines the VIS02 baseline (D15):
 * - every material is validated by MaterialParser (D1) and gets white /
 *   roughness 1 / metalness 0 defaults, so the maps are shown unchanged (D14);
 * - every map is a clone of the LoadedAssets texture with RepeatWrapping,
 *   because floor, walls and procedural shapes have UVs in metres (D3, D13);
 *   the colour map is sRGB and the data maps are linear (D4);
 * - materials with the same properties are shared (D5, AC 4);
 * - a scalar-only override tints clones of the model's materials (D6).
 *
 * The factory owns, and releases, only its materials and texture clones;
 * the textures and models of LoadedAssets are borrowed (BR 10, BR 18).
 */
export function createKitchenMaterialFactory(assets) {
  const cache = new Map();
  const ownedMaterials = [];
  const ownedTextures = [];

  function prepareMap(assetId, colorSpace) {
    const source = assets.getTexture(assetId);
    if (!source) throw new MissingTextureError(assetId);
    const map = source.clone();
    ownedTextures.push(map);
    map.wrapS = RepeatWrapping;
    map.wrapT = RepeatWrapping;
    map.colorSpace = colorSpace;
    map.needsUpdate = true;
    return map;
  }

  /** Builds (or reuses) the MeshStandardMaterial of a parsed DTO. */
  function materialFor(dto) {
    const key = JSON.stringify(dto);
    const cached = cache.get(key);
    if (cached) return cached;

    const parameters = {
      color: dto.color ?? DEFAULTS.color,
      roughness: dto.roughness ?? DEFAULTS.roughness,
      metalness: dto.metalness ?? DEFAULTS.metalness,
    };
    for (const [field, slot] of Object.entries(MAP_FIELDS))
      if (dto[field])
        parameters[slot] = prepareMap(
          dto[field],
          slot === 'map' ? SRGBColorSpace : NoColorSpace,
        );

    const material = new MeshStandardMaterial(parameters);
    cache.set(key, material);
    ownedMaterials.push(material);
    return material;
  }

  return {
    /**
     * Floor, walls and procedural elements: the texture set is mandatory.
     * @param {object} properties WEB06 MaterialProperties
     * @param {{ required?: boolean }} [options]
     */
    create(properties, { required = true } = {}) {
      return materialFor(parse(properties, { required }));
    },

        /**
     * Override on an imported clone (WEB06 ALN-6, D6): with maps, one factory
     * material replaces every mesh material; with scalars only, the model's
     * own materials are cloned and tinted, keeping their textures.
     */
    applyOverride(root, properties) {
      const dto = parse(properties, { required: false });
      if (MAP_KEYS.some((key) => dto[key]))
        MaterialApplicationHelper.applyToMeshes(root, materialFor(dto));
      else
        ownedMaterials.push(...MaterialApplicationHelper.tintMeshes(root, dto));
    },

    /** Releases only what this factory created; safe to call twice. */
    dispose(release = (resource) => resource.dispose()) {
      for (const material of ownedMaterials) release(material);
      for (const texture of ownedTextures) release(texture);
      ownedMaterials.length = 0;
      ownedTextures.length = 0;
      cache.clear();
    },
  };
}