import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';

// WEB06 MaterialProperties fields that reference preloaded textures.
const MAP_FIELDS = Object.freeze({
  colorMapAssetId: 'map',
  roughnessMapAssetId: 'roughnessMap',
  normalMapAssetId: 'normalMap',
  bumpMapAssetId: 'bumpMap',
});

const DEFAULTS = Object.freeze({
  color: '#d9d6cf',
  roughness: 0.8,
  metalness: 0,
});

export class MissingTextureError extends Error {
  constructor(assetId) {
    super(`A preloaded kitchen texture is missing: ${assetId}`);
    this.name = 'MissingTextureError';
    this.assetId = assetId;
  }
}

/**
 * Baseline material factory used by VIS02 (usVIS02 VIS02-ALN-2). VIS04 owns
 * textures and materials and can refine it behind the same interface:
 * create(properties, options), applyOverride(root, properties), dispose(release).
 *
 * Loaded textures are borrowed from LoadedAssets. A colour map is cloned so
 * that it can use the sRGB colour space even when another material uses the
 * same file as a linear map. Room surfaces use UVs in metres, so their maps
 * are cloned with RepeatWrapping instead of changing the shared texture.
 * The factory owns, and releases, only its materials and texture clones.
 */
export function createKitchenMaterialFactory(assets) {
  const materials = new Map();
  const ownedTextures = [];

  function texture(assetId, { colour, repeat }) {
    const loaded = assets.getTexture(assetId);
    if (!loaded) throw new MissingTextureError(assetId);
    if (!colour && !repeat) return loaded;
    const copy = loaded.clone();
    ownedTextures.push(copy);
    if (colour) copy.colorSpace = SRGBColorSpace;
    if (repeat) copy.wrapS = copy.wrapT = RepeatWrapping;
    copy.needsUpdate = true;
    return copy;
  }

  function create(properties = {}, { worldScaleUv = false } = {}) {
    const key = `${worldScaleUv}|${JSON.stringify(properties)}`;
    const cached = materials.get(key);
    if (cached) return cached;

    const parameters = {
      color: properties.color ?? DEFAULTS.color,
      roughness: properties.roughness ?? DEFAULTS.roughness,
      metalness: properties.metalness ?? DEFAULTS.metalness,
    };
    for (const [field, map] of Object.entries(MAP_FIELDS)) {
      const assetId = properties[field];
      if (!assetId) continue;
      parameters[map] = texture(assetId, {
        colour: map === 'map',
        repeat: worldScaleUv,
      });
    }
    const material = new MeshStandardMaterial(parameters);
    materials.set(key, material);
    return material;
  }

  return {
    create,

    /** WEB06 ALN-6: one material for every mesh of an imported clone. */
    applyOverride(root, properties) {
      const material = create(properties);
      root.traverse((object) => {
        if (object.isMesh) object.material = material;
      });
      return material;
    },

    dispose(release = (resource) => resource.dispose()) {
      for (const material of materials.values()) release(material);
      for (const copy of ownedTextures) release(copy);
      materials.clear();
      ownedTextures.length = 0;
    },
  };
}