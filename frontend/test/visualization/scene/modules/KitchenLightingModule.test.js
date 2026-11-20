import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Sphere,
  Texture,
  Vector3,
  WebGLCubeRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildEnvironmentMap,
  createKitchenLightingModule,
} from '../../../../src/visualization/scene/modules/KitchenLightingModule.js';

function setup() {
  const layout = new Group();
  layout.name = 'layout:root';
  const mesh = new Mesh(
    new BoxGeometry(12, 3, 8),
    new MeshStandardMaterial({ metalness: 1 }),
  );
  layout.add(mesh);
  const scene = new Scene().add(layout);
  const renderer = {
    capabilities: { maxTextureSize: 4096 },
    shadowMap: { enabled: false },
  };
  const environment = new WebGLCubeRenderTarget(16);
  const createEnvironmentMap = jest.fn(() => environment);
  const module = createKitchenLightingModule({ createEnvironmentMap });
  const context = {
    scene,
    renderer,
    signal: new AbortController().signal,
    disposeResource: (resource) => resource.dispose(),
  };
  return {
    module,
    context,
    scene,
    renderer,
    layout,
    mesh,
    environment,
    createEnvironmentMap,
  };
}

afterEach(() => jest.restoreAllMocks());

test('UT01/07 - attaches the two named lights and a reflection environment fixed in scene coordinates', () => {
  const { module, context, scene, environment, createEnvironmentMap, mesh } =
    setup();
  const camera = new PerspectiveCamera();
  scene.add(camera);
  module.build(context);
  const root = scene.getObjectByName('lighting:root');
  const key = root.getObjectByName('lighting:key');
  const ambient = root.getObjectByName('lighting:ambient');
  expect(root.children).toEqual([ambient, key, key.target]);
  expect(ambient.isAmbientLight && ambient.intensity > 0).toBe(true);
  expect(key.isSpotLight && key.intensity > 0).toBe(true);
  expect(ambient.castShadow).toBe(false);
  expect(key.castShadow).toBe(true);
  expect(key.target.name).toBe('lighting:key-target');
  const placement = key.getWorldPosition(new Vector3());
  camera.position.set(15, 8, -10);
  camera.lookAt(key.target.position);
  module.update(1 / 60);
  expect(key.getWorldPosition(new Vector3())).toEqual(placement);
  expect(scene.environment).toBe(environment.texture);
  expect(scene.environmentIntensity).toBe(0.65);
  expect(mesh.material.metalness).toBe(1);
  expect(createEnvironmentMap).toHaveBeenCalledTimes(1);
  module.dispose();
});

test.each([0.5, 4])(
  'UT02 - covers transformed layout and sibling line at scale %s',
  (scale) => {
    const { module, context, scene, layout, mesh } = setup();
    const parent = new Group();
    parent.position.set(-5, 2, 8);
    parent.rotation.y = 0.3;
    scene.add(parent);
    parent.add(layout);
    mesh.rotation.y = 0.5;
    mesh.scale.setScalar(scale);
    const line = new Group();
    line.name = 'layout:assembly-line';
    line.add(new Mesh(new BoxGeometry(1, 3, 2)));
    line.position.set(35, 3, -8);
    parent.add(line);
    module.build(context);
    const key = scene.getObjectByName('lighting:key');
    const sphere = new Box3()
      .setFromObject(parent)
      .getBoundingSphere(new Sphere());
    expect(
      key.target.getWorldPosition(new Vector3()).distanceTo(sphere.center),
    ).toBeLessThan(1e-8);
    const distance = key.position.distanceTo(sphere.center);
    expect(Math.asin(sphere.radius / distance)).toBeLessThan(
      key.angle * (1 - key.penumbra),
    );
    expect(key.shadow.camera.near).toBeLessThan(distance - sphere.radius);
    expect(key.shadow.camera.far).toBeGreaterThan(distance + sphere.radius);
    expect(key.intensity / distance ** 2).toBeCloseTo(1.7);
    module.dispose();
  },
);

test.each(['missing', 'empty', 'flat', 'non-finite'])(
  'UT03 - rejects %s layout bounds before allocating lighting',
  (problem) => {
    const { module, context, scene, layout, mesh, createEnvironmentMap } =
      setup();
    if (problem === 'missing') layout.removeFromParent();
    if (problem === 'empty') layout.clear();
    if (problem === 'flat') mesh.scale.y = 0;
    if (problem === 'non-finite') mesh.position.x = Infinity;
    expect(() => module.build(context)).toThrow(/layout/);
    expect(scene.getObjectByName('lighting:root')).toBeUndefined();
    expect(createEnvironmentMap).not.toHaveBeenCalled();
    module.dispose();
  },
);

test('UT03 - an aborted build acquires no lighting resources', () => {
  const { module, context, scene, createEnvironmentMap } = setup();
  module.build({ ...context, signal: AbortSignal.abort() });
  expect(scene.getObjectByName('lighting:root')).toBeUndefined();
  expect(createEnvironmentMap).not.toHaveBeenCalled();
  module.dispose();
});

test.each([
  [4096, 1024],
  [512, 512],
])(
  'UT04 - caps shadows on hardware with maximum texture size %i',
  (limit, expected) => {
    const { module, context, renderer, scene } = setup();
    renderer.capabilities.maxTextureSize = limit;
    module.build(context);
    const { shadow } = scene.getObjectByName('lighting:key');
    expect(renderer.shadowMap).toMatchObject({
      enabled: true,
      type: PCFShadowMap,
    });
    expect(shadow.mapSize.toArray()).toEqual([expected, expected]);
    expect(shadow.autoUpdate).toBe(false);
    expect(shadow.needsUpdate).toBe(true);
    shadow.needsUpdate = false;
    module.update(1 / 60);
    expect(shadow.needsUpdate).toBe(false);
    module.dispose();
  },
);

test.each([false, true])(
  'UT05 - disposes owned resources once and respects a replacement environment (%s)',
  (replaced) => {
    const { module, context, scene, mesh, layout, environment } = setup();
    const original = new Texture();
    scene.environment = original;
    scene.environmentIntensity = 0.4;
    const disposeMaterial = jest.spyOn(mesh.material, 'dispose');
    module.build(context);
    const key = scene.getObjectByName('lighting:key');
    const shadowTarget = { dispose: jest.fn() };
    key.shadow.map = shadowTarget;
    const next = new Texture();
    if (replaced) {
      scene.environment = next;
      scene.environmentIntensity = 0.7;
    }
    const disposeEnvironment = jest
      .spyOn(environment, 'dispose')
      .mockImplementation(() => {
        expect(scene.environment).toBe(replaced ? next : original);
        expect(scene.environmentIntensity).toBe(replaced ? 0.7 : 0.4);
      });
    module.dispose();
    module.dispose();
    expect(scene.getObjectByName('lighting:root')).toBeUndefined();
    expect(shadowTarget.dispose).toHaveBeenCalledTimes(1);
    expect(disposeEnvironment).toHaveBeenCalledTimes(1);
    expect(scene.getObjectByName('layout:root')).toBe(layout);
    expect(disposeMaterial).not.toHaveBeenCalled();
  },
);

test.each([false, true])(
  'UT06 - releases the temporary room and generator when filtering fails (%s)',
  (fails) => {
    const target = new WebGLCubeRenderTarget(16);
    const disposeTarget = jest.spyOn(target, 'dispose');
    const disposeRoom = jest.spyOn(RoomEnvironment.prototype, 'dispose');
    const disposeGenerator = jest.spyOn(PMREMGenerator.prototype, 'dispose');
    const filter = jest
      .spyOn(PMREMGenerator.prototype, 'fromScene')
      .mockReturnValue(target);
    const generate = () =>
      buildEnvironmentMap({}, (resource) => resource.dispose());
    if (fails) {
      filter.mockImplementation(() => {
        throw new Error('filter failed');
      });
      expect(generate).toThrow('filter failed');
    } else {
      expect(generate()).toBe(target);
    }
    expect(filter).toHaveBeenCalledWith(
      expect.any(RoomEnvironment),
      0,
      0.1,
      100,
      { size: 256 },
    );
    expect(disposeRoom).toHaveBeenCalledTimes(1);
    expect(disposeGenerator).toHaveBeenCalledTimes(1);
    expect(disposeTarget).not.toHaveBeenCalled();
  },
);
