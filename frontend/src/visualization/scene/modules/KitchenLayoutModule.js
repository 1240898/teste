import { Group } from 'three';
import { createProceduralShapeFactory } from '../elements/ProceduralShapeFactory.js';
import { createSceneElementFactory } from '../elements/SceneElementFactory.js';
import { createKitchenMaterialFactory } from '../materials/KitchenMaterialFactory.js';
import { buildKitchenRoom } from '../room/KitchenRoomBuilder.js';
import { LAYOUT_EQUIPMENT, LAYOUT_ROOT } from '../sceneObjectNames.js';

const disposeDirectly = (resource) => resource?.dispose?.();

/**
 * VIS02 - room and EQUIPMENT elements of the active configuration
 * (usVIS02 SD 1). Replaces the VIS01 KitchenFloorModule.
 *
 * build() is synchronous: every asset is already preloaded. The layout is
 * added to the scene only when it is complete; an element that cannot be
 * built throws and the viewer fails closed (BR 11). The camera is never
 * touched (BR 12, owned by VIS07). ASSEMBLY_LINE elements belong to VIS03.
 *
 * @returns {import('../sceneModule.js').SceneModule}
 */
export function createKitchenLayoutModule({
  createMaterialFactory = createKitchenMaterialFactory,
  buildRoom = buildKitchenRoom,
} = {}) {
  let release = disposeDirectly;
  let root;
  let materials;
  let shapes;
  let elements;
  let roomGeometries = [];
  const builtElements = [];
  let disposed = false;

  return {
    name: 'kitchen-layout',

    build(context) {
      if (context.signal?.aborted || disposed) return;
      release = context.disposeResource ?? disposeDirectly;
      const { configuration } = context;
      const { kitchen, elements: configured } = configuration.content;

      materials = createMaterialFactory(context.assets);
      shapes = createProceduralShapeFactory();
      elements = createSceneElementFactory({
        assets: context.assets,
        shapes,
        materials,
      });

      root = new Group();
      root.name = LAYOUT_ROOT;
      root.userData = {
        configurationId: configuration.id,
        version: configuration.version,
      };

      const room = buildRoom({
        dimensions: kitchen.dimensions,
        floorMaterial: materials.create(kitchen.floor?.material, {
          worldScaleUv: true,
        }),
        wallMaterial: materials.create(kitchen.walls?.material, {
          worldScaleUv: true,
        }),
      });
      roomGeometries = room.geometries;
      root.add(room.group);

      const equipment = new Group();
      equipment.name = LAYOUT_EQUIPMENT;
      root.add(equipment);
      for (const element of configured) {
        if (element.category !== 'EQUIPMENT') continue;
        const object = elements.create(element);
        builtElements.push(object);
        equipment.add(object);
      }

      context.scene.add(root);
    },

    update() {},

    dispose() {
      if (disposed) return;
      disposed = true;
      const steps = [
        () => root?.removeFromParent(),
        () => {
          for (const object of builtElements)
            elements?.release(object, release);
        },
        () => {
          for (const geometry of roomGeometries) release(geometry);
        },
        () => shapes?.dispose(release),
        () => materials?.dispose(release),
      ];
      const errors = [];
      for (const step of steps) {
        try {
          step();
        } catch (error) {
          errors.push(error);
        }
      }
      builtElements.length = 0;
      roomGeometries = [];
      root = materials = shapes = elements = undefined;
      if (errors.length)
        throw new AggregateError(errors, 'Kitchen layout cleanup failed');
    },
  };
}