const SCALAR_KEYS = Object.freeze(['color', 'roughness', 'metalness']);

/** Calls visit(material) for every material slot of every mesh under root. */
function forEachSlot(root, visit) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    if (Array.isArray(object.material))
      object.material = object.material.map((entry) => visit(entry));
    else object.material = visit(object.material);
  });
}

/**
 * Applies an asset-level override to every mesh of an imported model
 * (usVIS04 BR 9, BR 19, D6). Only Mesh nodes change; geometry and UV
 * attributes are never touched.
 */
export const MaterialApplicationHelper = Object.freeze({
  /** Override with maps: every mesh (and every array entry) gets the material. */
  applyToMeshes(root, material) {
    forEachSlot(root, () => material);
  },

  /**
   * Scalar-only override: each distinct original material is cloned ONCE
   * (meshes that shared it share the clone) and only the given color /
   * roughness / metalness are set. The clone keeps the model's maps, so the
   * colour acts as a tint (SGRAI W6 slide 205). Originals are unchanged.
   * @returns {import('three').Material[]} the clones, for the factory to dispose
   */
  tintMeshes(root, scalars) {
    const clones = new Map();
    forEachSlot(root, (original) => {
      let clone = clones.get(original);
      if (!clone) {
        clone = original.clone();
        if (scalars.color !== undefined && clone.color)
          clone.color.set(scalars.color);
        for (const key of SCALAR_KEYS.slice(1))
          if (scalars[key] !== undefined && key in clone)
            clone[key] = scalars[key];
        clones.set(original, clone);
      }
      return clone;
    });
    return [...clones.values()];
  },
});