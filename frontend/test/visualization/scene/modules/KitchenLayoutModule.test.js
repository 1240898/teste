import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { activeSample, fakeAssets } from '../__fixtures__/kitchenSamples.js';
import { ElementBuildError } from '../../../../src/visualization/scene/elements/ElementBuildError.js';
import { createKitchenMaterialFactory } from '../../../../src/visualization/scene/materials/KitchenMaterialFactory.js';
import { createKitchenLayoutModule } from '../../../../src/visualization/scene/modules/KitchenLayoutModule.js';

const AC2_TYPES = [
  'TABLE',
  'COUNTER',
  'WOOD_FIRED_OVEN',
  'DEEP_FRYER',
  'GRIDDLE',
  'GRILL',
  'REFRIGERATOR',
  'DISHWASHER',
  'EXHAUST_HOOD',
  'COOKING_TOOL',
];

function setup(name, { signal, missing, materialSpy } = {}) {
  const configuration = activeSample(name);
  const assets = fakeAssets(configuration, { missing });
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 200);
  camera.position.set(3, 4, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const released = [];
  const materials = [];
  const module = createKitchenLayoutModule({
    createMaterialFactory: (loaded) => {
      const factory = createKitchenMaterialFactory(loaded);
      materials.push(factory);
      if (materialSpy) jest.spyOn(factory, 'dispose');
      return factory;
    },
  });
  const context = {
    scene,
    camera,
    configuration,
    assets,
    signal: signal ?? new AbortController().signal,
    disposeResource: (resource) => {
      released.push(resource);
      resource.dispose();
    },
  };
  return {
    configuration,
    assets,
    scene,
    camera,
    module,
    context,
    released,
    materials,
  };
}

const equipmentOf = (configuration) =>
  configuration.content.elements.filter(
    (element) => element.category === 'EQUIPMENT',
  );
const roots = (scene) =>
  scene.getObjectByName('layout:equipment')?.children ?? [];

test('UT10 - one object per EQUIPMENT element at its configured position, none for the assembly line', () => {
  const h = setup('compact');
  const add = jest.spyOn(h.scene, 'add');
  h.module.build(h.context);
  expect(add).toHaveBeenCalledTimes(1);
  expect(h.scene.children.map((child) => child.name)).toEqual(['layout:root']);

  const equipment = equipmentOf(h.configuration);
  expect(roots(h.scene).map((root) => root.name)).toEqual(
    equipment.map(({ id }) => id),
  );
  for (const element of h.configuration.content.elements.filter(
    ({ category }) => category === 'ASSEMBLY_LINE',
  ))
    expect(h.scene.getObjectByName(element.id)).toBeUndefined();

  h.scene.updateMatrixWorld(true);
  for (const element of equipment) {
    const world = h.scene
      .getObjectByName(element.id)
      .getWorldPosition(new Vector3());
    const { x, y, z } = element.placement.position;
    expect(world.x).toBeCloseTo(x);
    expect(world.y).toBeCloseTo(y);
    expect(world.z).toBeCloseTo(z);
  }
});

test('UT11 - the extended kitchen has its room and every AC 2 equipment type', () => {
  const h = setup('extended');
  h.module.build(h.context);
  const floor = h.scene.getObjectByName('room:floor');
  floor.geometry.computeBoundingBox();
  const { min, max } = floor.geometry.boundingBox;
  expect([max.x - min.x, max.z - min.z]).toEqual([16, 10]);
  const north = h.scene.getObjectByName('room:wall:NORTH');
  north.geometry.computeBoundingBox();
  expect(north.geometry.boundingBox.max.y).toBeCloseTo(3.5);
  expect(roots(h.scene)).toHaveLength(equipmentOf(h.configuration).length);
  expect(new Set(roots(h.scene).map((root) => root.userData.type))).toEqual(
    new Set(AC2_TYPES),
  );
});

test('UT12 - an aborted build creates nothing', () => {
  const controller = new AbortController();
  controller.abort();
  const h = setup('compact', { signal: controller.signal });
  h.module.build(h.context);
  expect(h.scene.children).toHaveLength(0);
  expect(h.materials).toHaveLength(0);
  h.module.dispose();
  expect(h.released).toHaveLength(0);
});

test('UT13 - dispose is idempotent and never releases borrowed assets', () => {
  const h = setup('compact', { materialSpy: true });
  h.module.build(h.context);
  h.module.dispose();
  h.module.dispose();
  expect(h.scene.children).toHaveLength(0);
  expect(h.materials[0].dispose).toHaveBeenCalledTimes(1);
  expect(h.released.length).toBeGreaterThan(0);
  expect(new Set(h.released).size).toBe(h.released.length);
  for (const spy of h.assets.borrowed) expect(spy).not.toHaveBeenCalled();
});

test('UT14 - a failing element leaves the scene unchanged and dispose releases what was created', () => {
  const configuration = activeSample('extended');
  const failing = equipmentOf(configuration).filter(
    (e) => e.model.source === 'ASSET',
  )[0];
  const h = setup('extended', {
    missing: [failing.model.assetId],
    materialSpy: true,
  });
  expect(() => h.module.build(h.context)).toThrow(
    expect.objectContaining({
      constructor: ElementBuildError,
      elementId: failing.id,
    }),
  );
  expect(h.scene.children).toHaveLength(0);
  h.module.dispose();
  expect(h.materials[0].dispose).toHaveBeenCalledTimes(1);
  expect(h.released.some((resource) => resource.isBufferGeometry)).toBe(true);
});

test('UT15 - update changes nothing', () => {
  const h = setup('compact');
  h.module.build(h.context);
  const before = roots(h.scene).map((root) => root.matrix.clone());
  for (let frame = 0; frame < 100; frame += 1) h.module.update(0.016);
  roots(h.scene).forEach((root, index) =>
    expect(root.matrix.equals(before[index])).toBe(true),
  );
  expect(roots(h.scene)).toHaveLength(before.length);
});

test.each(['compact', 'extended'])(
  'UT16 - the %s layout never changes the camera',
  (name) => {
    const h = setup(name);
    const snapshot = () => [
      h.camera.position.clone(),
      h.camera.quaternion.clone(),
      h.camera.projectionMatrix.clone(),
      h.camera.near,
      h.camera.far,
    ];
    const before = snapshot();
    h.module.build(h.context);
    h.module.dispose();
    const after = snapshot();
    expect(after[0].equals(before[0])).toBe(true);
    expect(after[1].equals(before[1])).toBe(true);
    expect(after[2].equals(before[2])).toBe(true);
    expect(after.slice(3)).toEqual(before.slice(3));
  },

  
);
test('T27 - floor and walls use create() without options and the white / 1 / 0 defaults (VIS04-ALN-5, ALN-7)', () => {
  const h = setup('compact');
  let create;
  const module = createKitchenLayoutModule({
    createMaterialFactory: (loaded) => {
      const factory = createKitchenMaterialFactory(loaded);
      create = jest.spyOn(factory, 'create');
      return factory;
    },
  });
  module.build(h.context);

  const [floorCall, wallCall] = create.mock.calls;
  expect(floorCall).toEqual([h.configuration.content.kitchen.floor.material]);
  expect(wallCall).toEqual([h.configuration.content.kitchen.walls.material]);

  // The compact walls define maps only: no baseline #d9d6cf / 0.8.
  const walls = create.mock.results[1].value;
  expect(walls.color.getHexString()).toBe('ffffff');
  expect(walls.roughness).toBe(1);
  expect(walls.metalness).toBe(0);
  module.dispose();
});