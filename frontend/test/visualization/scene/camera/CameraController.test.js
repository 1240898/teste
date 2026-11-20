
import { jest } from '@jest/globals';
import { MOUSE, PerspectiveCamera, Vector3 } from 'three';
import { createCameraController } from '../../../../src/visualization/scene/camera/CameraController.js';
import { RESET_VIEW_EVENT } from '../../../../src/visualization/scene/camera/cameraSettings.js';

const LANDSCAPE = 16 / 9;
const PORTRAIT = 9 / 16;

/**
 * Test double of OrbitControls: keeps a pan momentum (like its internal pan
 * offset) and applies it in update() the way OrbitControls does - a fraction
 * per frame with damping, everything at once without damping. It never emits
 * "change", so the tests prove the limits do not depend on that event.
 */
function fakeControls(camera) {
  const controls = {
    target: new Vector3(3, 3, 3),
    mouseButtons: {},
    enableDamping: false,
    dampingFactor: 0,
    panMomentum: new Vector3(),
    beforeUpdate: null, // simulates pointer movement inside update()
    dampingStates: [],
    update: jest.fn(() => {
      controls.beforeUpdate?.();
      controls.dampingStates.push(controls.enableDamping);
      const share = controls.enableDamping ? controls.dampingFactor : 1;
      const move = controls.panMomentum.clone().multiplyScalar(share);
      controls.target.add(move);
      camera.position.add(move);
      if (controls.enableDamping) controls.panMomentum.multiplyScalar(1 - share);
      else controls.panMomentum.set(0, 0, 0);
    }),
    dispose: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  return controls;
}

const content = {
  kitchen: { dimensions: { width: 12, depth: 8, height: 3.2 } },
  assemblyLine: { wall: 'NORTH' },
};

function setup({ aspect = LANDSCAPE } = {}) {
  const camera = new PerspectiveCamera(45, aspect, 0.1, 200);
  const projection = jest.spyOn(camera, 'updateProjectionMatrix');
  const canvas = new EventTarget();
  const controls = fakeControls(camera);
  const controller = createCameraController(camera, canvas, content, {
    createControls: () => controls,
  });
  return { camera, projection, canvas, controls, controller };
}

const degrees = (radians) => (radians * 180) / Math.PI;

test('UT-13: FOV, near, far, mouse mapping, limits, damping and speeds of 2.4.1', () => {
  const { camera, projection, controls } = setup();
  expect(camera.fov).toBe(50);
  expect(camera.near).toBe(0.05);
  expect(camera.far).toBeCloseTo(34.2, 1);
  expect(projection).toHaveBeenCalled();
  expect(controls.mouseButtons).toEqual({
    LEFT: MOUSE.PAN,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.ROTATE,
  });
  expect(controls.minDistance).toBe(0.5);
  expect(controls.maxDistance).toBeCloseTo(19.45, 2);
  expect(degrees(controls.minPolarAngle)).toBeCloseTo(5);
  expect(degrees(controls.maxPolarAngle)).toBeCloseTo(85);
  expect(controls.enableDamping).toBe(true);
  expect(controls.dampingFactor).toBe(0.08);
  expect([controls.rotateSpeed, controls.panSpeed, controls.zoomSpeed]).toEqual([0.5, 0.8, 0.6]);
  expect(controls.screenSpacePanning).toBe(false);
  expect(controls.zoomToCursor).toBe(false);
});

test('UT-13: no "change" listener is registered (D4)', () => {
  const { controls } = setup();
  expect(controls.addEventListener).not.toHaveBeenCalledWith('change', expect.anything());
});

test('UT-14: opens on the floor centre, camera opposite the line (eight-corner fit)', () => {
  const { camera, controls } = setup();
  expect(controls.target.toArray()).toEqual([0, 0, 0]);
  expect(camera.position.x).toBeCloseTo(0, 5);
  expect(camera.position.y).toBeCloseTo(7.44, 2);
  expect(camera.position.z).toBeCloseTo(10.62, 2);
});

test('UT-15: the target is clamped in update() even without a "change" event', () => {
  const { camera, controls, controller } = setup();
  controls.beforeUpdate = () => {
    controls.target.set(6 + 1e-5, 0, 0); // tiny move: OrbitControls emits no change
    camera.position.set(6 + 1e-5, 7, 10);
  };
  controller.update();
  expect(controls.target.x).toBe(6);
  expect(camera.position.x).toBeCloseTo(6, 10);
});

test('UT-16: at the boundary the momentum is discarded and a reversed pan responds at once', () => {
  const { camera, controls, controller } = setup();
  controls.target.set(5.99, 0, 0);
  camera.position.set(5.99, 7, 10);
  controls.panMomentum.set(1, 0, 0);
  controls.dampingStates.length = 0;

  controller.update(); // pushed past x = 6 -> clamped, momentum flushed

  expect(controls.target.x).toBe(6);
  expect(camera.position.x - controls.target.x).toBeCloseTo(0, 10);
  expect(controls.dampingStates).toContain(false); // flushMomentum ran
  expect(controls.panMomentum.length()).toBe(0);
  expect(controls.enableDamping).toBe(true);

  controls.panMomentum.set(-0.5, 0, 0); // user reverses the drag
  controller.update();
  expect(controls.target.x).toBeLessThan(6); // moves inwards in that same frame
});

test('UT-17: a new aspect ratio recomputes maxDistance and far', () => {
  const { camera, projection, controls, controller } = setup();
  projection.mockClear();
  camera.aspect = PORTRAIT;
  controller.update();
  expect(controls.maxDistance).toBeCloseTo(44.08, 2);
  expect(camera.far).toBeCloseTo(58.9, 1);
  expect(projection).toHaveBeenCalled();

  projection.mockClear();
  controller.update(); // same aspect: nothing recomputed
  expect(projection).not.toHaveBeenCalled();
});

test('UT-17: beyond the new maxDistance the camera moves closer along the same direction', () => {
  const { camera, controls, controller } = setup({ aspect: PORTRAIT });
  const direction = new Vector3(1, 2, 2).normalize();
  controls.target.set(0, 0, 0);
  camera.position.copy(direction).multiplyScalar(40); // valid in portrait (max 44.08)

  camera.aspect = LANDSCAPE; // max becomes 19.45
  controller.update();

  const offset = camera.position.clone().sub(controls.target);
  expect(offset.length()).toBeCloseTo(19.45, 2);
  expect(offset.normalize().distanceTo(direction)).toBeCloseTo(0, 10);
});

test('UT-18: Reset view during inertia restores the initial view and the camera stays still', () => {
  const { camera, canvas, controls, controller } = setup();
  controls.target.set(2, 0, 1);
  camera.position.set(5, 1, 5);
  controls.panMomentum.set(2, 0, 0); // inertia still pending

  canvas.dispatchEvent(new Event(RESET_VIEW_EVENT));
  const resetPosition = camera.position.clone();

  expect(controls.target.toArray()).toEqual([0, 0, 0]);
  expect(resetPosition.y).toBeCloseTo(7.44, 2);
  expect(controls.panMomentum.length()).toBe(0);
  expect(controls.enableDamping).toBe(true);

  controller.update();
  controller.update();
  expect(camera.position.distanceTo(resetPosition)).toBe(0); // no drift
});

test('UT-19: dispose removes the listener, releases the controls and is idempotent', () => {
  const { camera, canvas, controls, controller } = setup();
  controller.dispose();
  controller.dispose();

  camera.position.set(5, 1, 5);
  canvas.dispatchEvent(new Event(RESET_VIEW_EVENT));
  const updates = controls.update.mock.calls.length;
  controller.update();

  expect(controls.dispose).toHaveBeenCalledTimes(1);
  expect(camera.position.x).toBe(5); // reset listener removed
  expect(controls.update).toHaveBeenCalledTimes(updates); // update() does nothing
});
