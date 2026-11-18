export const AssetKind = Object.freeze({ MODEL: 'MODEL', TEXTURE: 'TEXTURE' });

/**
 * Read-only catalogue entry (D8). MODEL: glb / gltf with size (metres, scale 1)
 * and embeddedTextureSet computed from the file; TEXTURE: both null.
 */
export class KitchenAsset {
  constructor({
    id,
    kind,
    format,
    path,
    description = '',
    size = null,
    embeddedTextureSet = null,
  }) {
    Object.assign(this, {
      id,
      kind,
      format,
      path,
      description,
      size: size ? Object.freeze({ x: size.x, y: size.y, z: size.z }) : null,
      embeddedTextureSet:
        kind === AssetKind.MODEL ? Boolean(embeddedTextureSet) : null,
    });
    Object.freeze(this);
  }
  isModel() {
    return this.kind === AssetKind.MODEL;
  }
}