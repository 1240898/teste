import { Group } from 'three';
import { createProceduralShapeFactory } from '../elements/ProceduralShapeFactory.js';
import { createSceneElementFactory } from '../elements/SceneElementFactory.js';
import { createKitchenMaterialFactory } from '../materials/KitchenMaterialFactory.js';
import { LAYOUT_ASSEMBLY_LINE, LAYOUT_ROOT } from '../sceneObjectNames.js';

const disposeDirectly = (resource) => resource.dispose();

/** @returns {import('../sceneModule.js').SceneModule} */
export function createAssemblyLineModule() {
  let release = disposeDirectly;
  let line;
  let materials;
  let shapes;
  let factory;
  let disposed = false;

  return {
    name: 'assembly-line',

    build({ scene, configuration, assets, signal, disposeResource }) {
      if (signal?.aborted || disposed) return;
      const layout = scene.getObjectByName(LAYOUT_ROOT);
      if (!layout)
        throw new Error(
          'Cannot build the assembly line before the kitchen layout',
        );

      release = disposeResource ?? disposeDirectly;
      line = new Group();
      line.name = LAYOUT_ASSEMBLY_LINE;
      shapes = createProceduralShapeFactory();
      materials = createKitchenMaterialFactory(assets);
      factory = createSceneElementFactory({
        assets,
        shapes,
        materials,
        disposeResource: release,
      });

      for (const element of configuration.content.elements) {
        if (signal?.aborted || disposed) return;
        if (element.category === 'ASSEMBLY_LINE')
          line.add(factory.create(element));
      }
      if (!signal?.aborted && !disposed) layout.add(line);
    },

    update() {},

    dispose() {
      if (disposed) return;
      disposed = true;
      const errors = [];
      const attempt = (cleanup) => {
        try {
          cleanup();
        } catch (error) {
          errors.push(error);
        }
      };

      attempt(() => line?.removeFromParent());
      for (const element of line?.children ?? [])
        attempt(() => factory.release(element, release));
      attempt(() => shapes?.dispose(release));
      attempt(() => materials?.dispose(release));
      line = factory = shapes = materials = undefined;
      if (errors.length)
        throw new AggregateError(errors, 'Assembly line cleanup failed');
    },
  };
}
