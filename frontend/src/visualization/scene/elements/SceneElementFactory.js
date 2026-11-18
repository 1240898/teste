import { Group, Mesh } from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { MissingTextureError } from '../materials/KitchenMaterialFactory.js';
import { ElementBuildError } from './ElementBuildError.js';
import { applyPlacement } from './placementTransform.js';
import { ShapeError } from './ProceduralShapeFactory.js';
import { modelPart } from '../sceneObjectNames.js';

/**
 * BR 3: names are reserved for element roots. Every named node of a cloned
 * model is renamed `part:<name>` (element ids cannot contain ':'); the name of
 * the file is kept in userData.partName.
 */
function namespaceParts(copy) {
  copy.traverse((object) => {
    if (!object.name) return;
    object.userData = { ...object.userData, partName: object.name };
    object.name = modelPart(object.name);
  });
}

function enableShadows(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

/**
 * Turns one WEB06 element into one 3D object (usVIS02 BR 2 - BR 8, BR 11,
 * BR 13). Shared by VIS02 (EQUIPMENT) and VIS03 (ASSEMBLY_LINE).
 *
 * The representation comes from element.model, never from element.type.
 * Imported models are cloned from LoadedAssets: their geometries and
 * materials stay borrowed and are never disposed here. No URL is read.
 */
export function createSceneElementFactory({ assets, shapes, materials }) {
  function buildProcedural(element) {
    const { shape, size } = element.model;
    const geometry = shapes.geometry(shape, size);
    const material = materials.create(element.material);
    return new Mesh(geometry, material);
  }

  function buildImported(element) {
    const { assetId } = element.model;
    const model = assets.getModel(assetId);
    if (!model?.scene) {
      const reason = assets.getTexture(assetId)
        ? 'asset-kind'
        : 'asset-missing';
      throw new ElementBuildError(element.id, reason);
    }
    const copy = cloneSkinned(model.scene);
    namespaceParts(copy);
    if (element.material) materials.applyOverride(copy, element.material);
    return copy;
  }

  return {
    /**
     * @param {object} element WEB06 SceneElement
     * @param {{isStatic?: boolean}} [options] VIS03 keeps animated parts dynamic
     * @returns {import('three').Group}
     */
    create(element, { isStatic = true } = {}) {
      const root = new Group();
      root.name = element.id;
      root.userData = {
        elementId: element.id,
        category: element.category,
        type: element.type,
        name: element.name,
      };

      try {
        const source = element.model?.source;
        if (source === 'PROCEDURAL') root.add(buildProcedural(element));
        else if (source === 'ASSET') root.add(buildImported(element));
        else throw new ElementBuildError(element.id, 'unknown-shape');
      } catch (error) {
        if (error instanceof ElementBuildError) throw error;
        if (error instanceof ShapeError)
          throw new ElementBuildError(element.id, error.reason, {
            cause: error,
          });
        if (error instanceof MissingTextureError)
          throw new ElementBuildError(element.id, 'asset-missing', {
            cause: error,
          });
        throw error;
      }

      if (!applyPlacement(root, element.placement, { isStatic }))
        throw new ElementBuildError(element.id, 'invalid-number');
      enableShadows(root);
      return root;
    },

    /** Releases what a clone owns: only the skeletons of skinned meshes. */
    release(root, release = (resource) => resource.dispose()) {
      root?.traverse((object) => {
        if (object.isSkinnedMesh) release(object.skeleton);
      });
    },
  };
}