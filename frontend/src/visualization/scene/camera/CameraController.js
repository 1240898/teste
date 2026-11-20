import { MOUSE, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeCameraLimits, computeInitialView } from './cameraLimits.js';
import {
  DAMPING_FACTOR,
  FOV_DEGREES,
  MAX_POLAR_DEGREES,
  MIN_POLAR_DEGREES,
  PAN_SPEED,
  RESET_VIEW_EVENT,
  ROTATE_SPEED,
  ZOOM_SPEED,
  toRadians,
} from './cameraSettings.js';
import { clampTarget } from './clampTarget.js';

const makeOrbitControls = (camera, domElement) =>
  new OrbitControls(camera, domElement);

/**
 * VIS07 - the ONLY writer of the camera position and target (BR 8).
 *
 * - FOV 50 deg, near 0.05 m, far from the layout and the aspect ratio (2.4.1);
 * - left drag = pan, right drag = orbit, wheel = dolly (BR 3, D2);
 * - initial view framing the eight kitchen corners, opposite the assembly-line
 *   wall (BR 2, D11); "Reset view" through RESET_VIEW_EVENT (BR 11, D10);
 * - on every frame, before render (update()): limits recomputed when the aspect
 *   ratio changed (BR 6, D6), damping advanced, target clamped to the floor
 *   and, at the boundary, the remaining momentum applied at once and stopped
 *   (BR 4, D4). No "change"
 *   listener: OrbitControls does not emit it for very small movements.
 *
 * @param {import('three').PerspectiveCamera} camera
 * @param {HTMLCanvasElement} domElement
 * @param {{ kitchen: { dimensions: object }, assemblyLine?: { wall?: string } }} content
 */
export function createCameraController(
  camera,
  domElement,
  content,
  { createControls = makeOrbitControls } = {},
) {
  const dimensions = content.kitchen.dimensions;
  const wall = content.assemblyLine?.wall;
  let lastAspect = camera.aspect;
  let limits = computeCameraLimits(dimensions, lastAspect, wall);
  let initialView = computeInitialView(limits, wall);
  let disposed = false;
  const offset = new Vector3(); // reused: no allocation per frame

  camera.fov = FOV_DEGREES;
  camera.near = limits.near;

  const controls = createControls(camera, domElement);
  controls.mouseButtons = {
    LEFT: MOUSE.PAN,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.ROTATE,
  };
  controls.minPolarAngle = toRadians(MIN_POLAR_DEGREES);
  controls.maxPolarAngle = toRadians(MAX_POLAR_DEGREES);
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.enableDamping = true;
  controls.dampingFactor = DAMPING_FACTOR;
  controls.rotateSpeed = ROTATE_SPEED;
  controls.panSpeed = PAN_SPEED;
  controls.zoomSpeed = ZOOM_SPEED;
  controls.screenSpacePanning = false; // pan on the floor plane (D3)
  controls.zoomToCursor = false; // dolly towards the target (D6)

  /** Distance limits and far plane of the current `limits`. */
  function applyLimits() {
    controls.minDistance = limits.minDistance;
    controls.maxDistance = limits.maxDistance;
    camera.far = limits.far;
    camera.updateProjectionMatrix();
  }

  /** Applies what is left of the damping at once and stops it (D4, D10). */
  function flushMomentum() {
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
  }

  /** BR 6 / D6: new limits for a new aspect ratio, keeping the user's view. */
  function syncAspect() {
    if (camera.aspect === lastAspect) return;
    lastAspect = camera.aspect;
    limits = computeCameraLimits(dimensions, lastAspect, wall);
    initialView = computeInitialView(limits, wall);
    applyLimits();
    offset.copy(camera.position).sub(controls.target);
    const distance = offset.length();
    if (distance > limits.maxDistance) {
      offset.multiplyScalar(limits.maxDistance / distance);
      camera.position.copy(controls.target).add(offset);
    }
  }

  const clampToFloor = () =>
    clampTarget(controls.target, camera.position, limits.targetBounds);

  function applyInitialView() {
    if (disposed) return;
    flushMomentum(); // no residual movement after the reset (D10)
    const { position, target } = initialView;
    camera.position.set(position.x, position.y, position.z);
    controls.target.set(target.x, target.y, target.z);
    controls.update();
  }

  const onResetView = () => applyInitialView();

  applyLimits();
  domElement.addEventListener(RESET_VIEW_EVENT, onResetView);
  applyInitialView();

  return {
    get limits() {
      return limits;
    },
    get initialView() {
      return initialView;
    },
    applyInitialView,
    resetView: applyInitialView,

    /** Called once per frame by CameraControlsModule, before render. */
    update() {
      if (disposed) return;
      syncAspect();
      controls.update();
      if (clampToFloor()) {
        flushMomentum(); // a reversed drag responds immediately
        clampToFloor();
      }
    },

    /** Removes the listener and releases the controls. Idempotent. */
    dispose() {
      if (disposed) return;
      disposed = true;
      domElement.removeEventListener(RESET_VIEW_EVENT, onResetView);
      controls.dispose();
    },
  };
}
