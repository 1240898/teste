import { Group } from 'three';
import { activeSample, fakeAssets } from '../__fixtures__/kitchenSamples.js';
import { createProceduralShapeFactory } from '../../../../src/visualization/scene/elements/ProceduralShapeFactory.js';
import { createSceneElementFactory } from '../../../../src/visualization/scene/elements/SceneElementFactory.js';
import { createKitchenMaterialFactory } from '../../../../src/visualization/scene/materials/KitchenMaterialFactory.js';
import { LAYOUT_ASSEMBLY_LINE } from '../../../../src/visualization/scene/sceneObjectNames.js';
import { ViewerEngine } from '../../../../src/visualization/scene/ViewerEngine.js';
import { createKitchenLayoutModule } from '../../../../src/visualization/scene/modules/KitchenLayoutModule.js';

function createEngine() {
  const renderer = {
    setPixelRatio: jest.fn(),
    setSize: jest.fn(),
    render: jest.fn(),
    setAnimationLoop: jest.fn(),
    dispose: jest.fn(),
    forceContextLoss: jest.fn(),
  };
  return ViewerEngine.create(
    new EventTarget(),
    { clientWidth: 800, clientHeight: 450 },
    {
      rendererFactory: () => renderer,
      resizeObserverFactory: () => ({
        observe: jest.fn(),
        disconnect: jest.fn(),
      }),
    },
  );
}

// Stand-in for the VIS03 module (VIS02-ALN-3): ASSEMBLY_LINE elements only,
// with the shared element factory.
function createFakeAssemblyLineModule() {
  let group;
  let shapes;
  let materials;
  return {
    name: 'assembly-line',
    build({ scene, configuration, assets }) {
      shapes = createProceduralShapeFactory();
      materials = createKitchenMaterialFactory(assets);
      const elements = createSceneElementFactory({ assets, shapes, materials });
      group = new Group();
      group.name = LAYOUT_ASSEMBLY_LINE;
      for (const element of configuration.content.elements)
        if (element.category === 'ASSEMBLY_LINE')
          group.add(elements.create(element, { isStatic: false }));
      scene.add(group);
    },
    update() {},
    dispose() {
      group?.removeFromParent();
      shapes?.dispose();
      materials?.dispose();
    },
  };
}

test('FT01 - with VIS03, every element of the configuration is in the scene exactly once', async () => {
  const configuration = activeSample('compact');
  const engine = createEngine();
  let scene;
  const spy = () => ({
    name: 'probe',
    build: (context) => {
      scene = context.scene;
    },
    update() {},
    dispose() {},
  });
  await expect(
    engine.load(configuration, fakeAssets(configuration), [
      createKitchenLayoutModule,
      createFakeAssemblyLineModule,
      spy,
    ]),
  ).resolves.toBe(true);
  const found = [];
  scene.traverse(
    (object) =>
      object.userData.elementId && found.push(object.userData.elementId),
  );
  expect(found.sort()).toEqual(
    configuration.content.elements.map(({ id }) => id).sort(),
  );
  engine.dispose();
});

test('FT02 - a missing equipment asset fails the build of kitchen-layout', async () => {
  const configuration = activeSample('compact');
  const assets = fakeAssets(configuration, { missing: ['AST-MDL-FRIDGE-02'] });
  const engine = createEngine();
  const error = await engine
    .load(configuration, assets, [createKitchenLayoutModule])
    .catch((reason) => reason);
  expect(error).toMatchObject({ phase: 'build', moduleName: 'kitchen-layout' });
  expect(error.cause).toMatchObject({
    name: 'ElementBuildError',
    elementId: 'fridge-1',
  });
  expect(assets.dispose).toHaveBeenCalled();
  expect(engine.start()).toBe(false);
});