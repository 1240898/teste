import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Box3,
  PMREMGenerator,
  Raycaster,
  Texture,
  Vector3,
  WebGLCubeRenderTarget,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../../backend/assets/kitchen/manifest.json';
import { activeSample, fakeAssets } from '../__fixtures__/kitchenSamples.js';
import { defaultSceneModules } from '../../../../src/visualization/scene/defaultSceneModules.js';
import { LoadedAssets } from '../../../../src/visualization/scene/SceneAssetLoader.js';
import {
  LAYOUT_ASSEMBLY_LINE,
  LAYOUT_ROOT,
} from '../../../../src/visualization/scene/sceneObjectNames.js';
import { createTestViewer } from '../__fixtures__/viewerEngine.js';
import { createKitchenLayoutModule } from '../../../../src/visualization/scene/modules/KitchenLayoutModule.js';

// Exercise the production composition. Only environment filtering needs a GPU.
beforeEach(() => {
  jest
    .spyOn(PMREMGenerator.prototype, 'fromScene')
    .mockImplementation(() => new WebGLCubeRenderTarget(16));
});
afterEach(() => jest.restoreAllMocks());

async function loadShippedLineAssets(configuration) {
  const assetIds = new Set(
    configuration.content.elements
      .filter(({ category }) => category === 'ASSEMBLY_LINE')
      .map(({ model }) => model.assetId)
      .filter(Boolean),
  );
  const loader = new GLTFLoader();
  // This suite tests GLB geometry and hierarchy. Node has no image decoder
  // for the embedded textures, so give those dependencies a Texture object.
  loader.register(() => ({
    name: 'TestTextureLoader',
    loadTexture: () => Promise.resolve(new Texture()),
  }));
  const entries = await Promise.all(
    [...assetIds].map(async (id) => {
      const { path } = manifest.assets.find((asset) => asset.id === id);
      const file = resolve(
        __dirname,
        '../../../../../backend/assets/kitchen/files',
        path,
      );
      const bytes = new Uint8Array(readFileSync(file));
      const resource = await loader.parseAsync(bytes.buffer, '');
      return [id, { kind: 'MODEL', resource }];
    }),
  );
  return new LoadedAssets(entries);
}

test.each([
  ['compact', 8],
  ['extended', 10],
])(
  'FT01 - the default viewer builds every %s element once, including %i line elements',
  async (sample, count) => {
    const configuration = activeSample(sample);
    const { engine } = createTestViewer();
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
        ...defaultSceneModules,
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
    const line = scene.getObjectByName(LAYOUT_ASSEMBLY_LINE);
    expect(line.parent.name).toBe(LAYOUT_ROOT);
    expect(line.children).toHaveLength(count);
    expect(
      line.children.every(
        (child) => child.userData.category === 'ASSEMBLY_LINE',
      ),
    ).toBe(true);
    engine.dispose();
  },
);

test.each([
  ['compact', 1],
  ['extended', -1],
])(
  'VIS03 - the shipped GLBs preserve independent joints and the conveyor handoffs in %s',
  async (sample, travelX) => {
    const configuration = activeSample(sample);
    const shipped = await loadShippedLineAssets(configuration);
    const standIns = fakeAssets(configuration);
    const assets = {
      getModel: (id) => shipped.getModel(id) ?? standIns.getModel(id),
      getTexture: standIns.getTexture,
      dispose: (release) => {
        shipped.dispose(release);
        standIns.dispose();
      },
    };
    const { engine } = createTestViewer();
    let line;
    const probe = () => ({
      name: 'probe',
      build({ scene }) {
        line = scene.getObjectByName(LAYOUT_ASSEMBLY_LINE);
      },
      update() {},
      dispose() {},
    });
    try {
      await expect(
        engine.load(configuration, assets, [...defaultSceneModules, probe]),
      ).resolves.toBe(true);
      line.updateWorldMatrix(true, true);

      const firstArm = line.getObjectByName('line-arm-1');
      const secondArm = line.getObjectByName('line-arm-2');
      const shoulder = firstArm.getObjectByName('part:shoulder');
      const tip = firstArm.getObjectByName('part:end-effector');
      const secondTip = secondArm.getObjectByName('part:end-effector');
      const sourceShoulder = shipped
        .getModel('AST-MDL-ROBOT-ARM-02')
        .scene.getObjectByName('shoulder');
      const position = (part) => part.getWorldPosition(new Vector3());
      const tipBefore = position(tip);
      const secondBefore = position(secondTip);
      const sourceBefore = sourceShoulder.quaternion.clone();

      shoulder.rotateX(Math.PI / 8);

      expect(position(tip).distanceTo(tipBefore)).toBeGreaterThan(0.01);
      expect(position(secondTip)).toEqual(secondBefore);
      expect(sourceShoulder.quaternion.equals(sourceBefore)).toBe(true);

      const platform = line.getObjectByName('line-platform');
      const belt = line.getObjectByName('line-belt');
      const surface = belt.getObjectByName('part:belt-surface');
      const oven = line.getObjectByName('line-oven');
      const hearth = oven.getObjectByName('part:hearth');
      const platformBounds = new Box3().setFromObject(platform);
      const surfaceBounds = new Box3().setFromObject(surface);
      const hearthBounds = new Box3().setFromObject(hearth);
      const forward = new Vector3(travelX, 0, 0);
      const firstEdge = (bounds) =>
        travelX === 1 ? bounds.min.x : bounds.max.x;
      const lastEdge = (bounds) =>
        travelX === 1 ? bounds.max.x : bounds.min.x;

      expect(firstEdge(surfaceBounds)).toBeCloseTo(lastEdge(platformBounds), 5);
      expect(lastEdge(surfaceBounds)).toBeCloseTo(firstEdge(hearthBounds), 5);
      expect(platformBounds.max.y - surfaceBounds.max.y).toBeCloseTo(0.005, 5);
      expect(surfaceBounds.max.y).toBeCloseTo(hearthBounds.max.y, 5);
      expect(platformBounds.min.z).toBeLessThan(surfaceBounds.min.z);
      expect(platformBounds.max.z).toBeGreaterThan(surfaceBounds.max.z);
      expect(
        belt
          .localToWorld(new Vector3(1, 0, 0))
          .sub(position(belt))
          .dot(forward),
      ).toBeGreaterThan(0);

      const centreZ = surfaceBounds.getCenter(new Vector3()).z;
      for (const lateralOffset of [-0.25, 0, 0.25]) {
        const atEntrance = new Vector3(
          lastEdge(surfaceBounds),
          surfaceBounds.max.y + 0.04,
          centreZ + lateralOffset,
        );
        const view = new Raycaster(
          atEntrance.addScaledVector(forward, -0.05),
          forward,
        );
        const [hit] = view.intersectObject(oven);
        expect(hit?.object.name).toBe('part:firebox-back');
        expect(hit.distance).toBeGreaterThan(0.35);
      }
    } finally {
      engine.dispose();
    }
  },
);

test('a missing line model fails the build and releases the active attempt', async () => {
  const configuration = activeSample('compact');
  const assets = fakeAssets(configuration, {
    missing: ['AST-MDL-ROBOT-ARM-02'],
  });
  const { engine } = createTestViewer();
  const error = await engine
    .load(configuration, assets, defaultSceneModules)
    .catch((reason) => reason);
  expect(error).toMatchObject({
    phase: 'build',
    moduleName: 'assembly-line',
    cause: { name: 'ElementBuildError', elementId: 'line-arm-1' },
  });
  expect(assets.dispose).toHaveBeenCalledTimes(1);
  expect(engine.start()).toBe(false);
});

test('a configured procedural arm remains a single static mesh', async () => {
  const configuration = activeSample('compact');
  const arm = configuration.content.elements.find(
    ({ id }) => id === 'line-arm-1',
  );
  arm.model = {
    source: 'PROCEDURAL',
    shape: 'BOX',
    size: { x: 0.4, y: 1.2, z: 0.4 },
  };
  arm.material = {
    colorMapAssetId: 'AST-TEX-STEEL-COLOR',
    roughnessMapAssetId: 'AST-TEX-STEEL-ROUGH',
  };
  const { engine } = createTestViewer();
  let root;
  const probe = () => ({
    name: 'probe',
    build({ scene }) {
      root = scene.getObjectByName(arm.id);
    },
    update() {},
    dispose() {},
  });
  await expect(
    engine.load(configuration, fakeAssets(configuration), [
      ...defaultSceneModules,
      probe,
    ]),
  ).resolves.toBe(true);
  expect(root.parent.name).toBe(LAYOUT_ASSEMBLY_LINE);
  expect(root.position.toArray()).toEqual(
    Object.values(arm.placement.position),
  );
  expect(root.matrixAutoUpdate).toBe(false);
  expect(root.children).toHaveLength(1);
  expect(root.children[0].isMesh).toBe(true);
  engine.dispose();
});

test('FT02 - a missing equipment asset fails the build of kitchen-layout', async () => {
  const configuration = activeSample('compact');
  const assets = fakeAssets(configuration, { missing: ['AST-MDL-FRIDGE-02'] });
  const { engine } = createTestViewer();
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
