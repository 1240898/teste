import { Vector3 } from 'three';
import { createCameraControlsModule } from '../../../src/visualization/scene/modules/CameraControlsModule.js';
import { ViewerEngine } from '../../../src/visualization/scene/ViewerEngine.js';

const configuration = {
  content: {
    kitchen: { dimensions: { width: 12, depth: 8, height: 3.2 } },
    assemblyLine: { wall: 'NORTH' },
  },
};

// Canvas double with what OrbitControls needs to attach its listeners.
function canvasDouble() {
  const canvas = new EventTarget();
  const doc = { addEventListener() {}, removeEventListener() {} };
  return Object.assign(canvas, {
    style: {},
    ownerDocument: doc,
    getRootNode: () => doc,
    setPointerCapture() {},
    releasePointerCapture() {},
  });
}

function setup() {
  const order = [];
  const container = { clientWidth: 1600, clientHeight: 900 }; // 16:9
  const renderer = {
    setPixelRatio: jest.fn(),
    setSize: jest.fn(),
    render: jest.fn(),
    setAnimationLoop: jest.fn(),
    dispose: jest.fn(),
    forceContextLoss: jest.fn(),
  };
  const engine = ViewerEngine.create(canvasDouble(), container, {
    rendererFactory: () => renderer,
    resizeObserverFactory: () => ({ observe() {}, disconnect() {} }),
  });
  // Records the dispose order of each module.
  const tracked = (makeModule) => () => {
    const module = makeModule();
    return {
      ...module,
      dispose: () => {
        order.push(module.name);
        module.dispose();
      },
    };
  };
  const layout = () => ({
    name: 'kitchen-layout',
    build() {},
    update() {},
    dispose() {},
  });
  const factories = [tracked(layout), tracked(createCameraControlsModule)];
  const load = () =>
    engine.load(configuration, { dispose: jest.fn() }, factories);
  const frame = () =>
    renderer.setAnimationLoop.mock.calls.find(([callback]) => callback)?.[0];
  const camera = () => renderer.render.mock.calls.at(-1)[1];
  return { engine, order, load, frame, camera };
}

test('IT-2: the engine with the camera module opens on the floor centre and disposes it first', async () => {
  const h = setup();
  await expect(h.load()).resolves.toBe(true);
  expect(h.engine.start()).toBe(true);

  const camera = h.camera();
  expect(camera.fov).toBe(50);
  expect(camera.position.x).toBeCloseTo(0, 5);
  expect(camera.position.y).toBeCloseTo(7.44, 2);
  expect(camera.position.z).toBeCloseTo(10.62, 2);
  camera.updateMatrixWorld();
  const looking = camera.getWorldDirection(new Vector3());
  const toCentre = camera.position.clone().negate().normalize();
  expect(looking.distanceTo(toCentre)).toBeCloseTo(0, 6);

  h.engine.dispose();
  expect(h.order).toEqual(['camera-controls', 'kitchen-layout']);
});

test('IT-3: a resize to portrait through the engine recomputes the limits on the next frame', async () => {
  const h = setup();
  await h.load();
  h.engine.start();
  const camera = h.camera();
  expect(camera.far).toBeCloseTo(34.2, 1);

  h.engine.resize(900, 1600); // 9:16
  h.frame()(16);

  expect(camera.aspect).toBeCloseTo(9 / 16);
  expect(camera.far).toBeCloseTo(58.9, 1);
  h.engine.dispose();
});