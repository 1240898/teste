
import { PerspectiveCamera, Vector3 } from 'three';
import {
  azimuthForWall,
  computeCameraLimits,
  computeFitDistance,
  computeInitialView,
} from '../../../../src/visualization/scene/camera/cameraLimits.js';
import {
  FOV_DEGREES,
  INITIAL_POLAR_DEGREES,
  toRadians,
} from '../../../../src/visualization/scene/camera/cameraSettings.js';

const kitchen = { width: 12, depth: 8, height: 3.2 };
const LANDSCAPE = 16 / 9;
const PORTRAIT = 9 / 16;
const WALLS = ['NORTH', 'SOUTH', 'EAST', 'WEST'];

/** Largest |NDC x| / |NDC y| of the eight kitchen corners seen from `position`. */
function worstCorner({ width, depth, height }, aspect, position) {
  const camera = new PerspectiveCamera(FOV_DEGREES, aspect, 0.05, 1000);
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  let worst = 0;
  for (const x of [-width / 2, width / 2])
    for (const y of [0, height])
      for (const z of [-depth / 2, depth / 2]) {
        const ndc = new Vector3(x, y, z).project(camera);
        worst = Math.max(worst, Math.abs(ndc.x), Math.abs(ndc.y));
      }
  return worst;
}

const initialPosition = (dimensions, aspect, wall) =>
  computeInitialView(computeCameraLimits(dimensions, aspect, wall), wall)
    .position;

test('UT-1: 2.4.1 example (12 x 8 x 3.2 m, NORTH, 16:9)', () => {
  const limits = computeCameraLimits(kitchen, LANDSCAPE, 'NORTH');
  expect(limits.fitDistance).toBeCloseTo(12.97, 2);
  expect(limits.maxDistance).toBeCloseTo(19.45, 2);
  expect(limits.far).toBeCloseTo(34.2, 1);
  expect(limits.minDistance).toBe(0.5);
  expect(limits.near).toBe(0.05);
  expect(limits.targetBounds).toEqual({ minX: -6, maxX: 6, minZ: -4, maxZ: 4 });

  const { position } = computeInitialView(limits, 'NORTH');
  expect(position.x).toBeCloseTo(0, 5);
  expect(position.y).toBeCloseTo(7.44, 2);
  expect(position.z).toBeCloseTo(10.62, 2);
});

test.each(WALLS)('UT-2: all eight corners inside the view in 16:9 (%s)', (wall) => {
  expect(worstCorner(kitchen, LANDSCAPE, initialPosition(kitchen, LANDSCAPE, wall)))
    .toBeLessThanOrEqual(1);
});

test.each(WALLS)('UT-3: all eight corners inside the view in portrait 9:16 (%s)', (wall) => {
  expect(worstCorner(kitchen, PORTRAIT, initialPosition(kitchen, PORTRAIT, wall)))
    .toBeLessThanOrEqual(1);
  expect(computeCameraLimits(kitchen, PORTRAIT, 'NORTH').fitDistance).toBeCloseTo(29.39, 2);
});

test.each([LANDSCAPE, PORTRAIT])(
  'UT-4: small, tall kitchen 2 x 2 x 2 m - top of the walls inside the view (aspect %f)',
  (aspect) => {
    const small = { width: 2, depth: 2, height: 2 };
    for (const wall of WALLS)
      expect(worstCorner(small, aspect, initialPosition(small, aspect, wall)))
        .toBeLessThanOrEqual(1);
  },
);

test('UT-4: portrait maxDistance lets the user see the whole kitchen', () => {
  const limits = computeCameraLimits(kitchen, PORTRAIT, 'NORTH');
  expect(limits.maxDistance).toBeGreaterThan(limits.fitDistance);
  expect(limits.maxDistance).toBeCloseTo(44.08, 2);
  expect(limits.far).toBeCloseTo(58.9, 1);
});

test.each([
  [{ width: 2, depth: 2, height: 2 }],
  [{ width: 100, depth: 100, height: 10 }],
])('UT-5: WEB06 extreme dimensions give ordered finite limits %p', (dimensions) => {
  for (const aspect of [LANDSCAPE, PORTRAIT]) {
    const limits = computeCameraLimits(dimensions, aspect, 'NORTH');
    for (const value of [limits.fitDistance, limits.maxDistance, limits.far])
      expect(Number.isFinite(value)).toBe(true);
    expect(limits.minDistance).toBeLessThan(limits.fitDistance);
    expect(limits.fitDistance).toBeLessThan(limits.maxDistance);
    expect(limits.maxDistance).toBeLessThan(limits.far);
  }
});

test.each([LANDSCAPE, PORTRAIT])('UT-6: without margin the fit is tight (aspect %f)', (aspect) => {
  const azimuth = azimuthForWall('NORTH');
  const polar = toRadians(INITIAL_POLAR_DEGREES);
  const distance = computeFitDistance(kitchen, aspect, azimuth, polar, 1);
  const horizontal = distance * Math.sin(polar);
  const position = {
    x: horizontal * Math.sin(azimuth),
    y: distance * Math.cos(polar),
    z: horizontal * Math.cos(azimuth),
  };
  expect(worstCorner(kitchen, aspect, position)).toBeCloseTo(1, 6);
});

test.each([
  ['NORTH', (p) => p.z > 0 && Math.abs(p.x) < 1e-9],
  ['SOUTH', (p) => p.z < 0 && Math.abs(p.x) < 1e-9],
  ['EAST', (p) => p.x < 0 && Math.abs(p.z) < 1e-9],
  ['WEST', (p) => p.x > 0 && Math.abs(p.z) < 1e-9],
])('UT-7: camera opposite the %s wall, target at the floor centre', (wall, check) => {
  const limits = computeCameraLimits(kitchen, LANDSCAPE, wall);
  const view = computeInitialView(limits, wall);
  expect(view.target).toEqual({ x: 0, y: 0, z: 0 });
  expect(view.polar).toBeCloseTo(toRadians(55));
  expect(view.distance).toBe(limits.fitDistance);
  expect(check(view.position)).toBe(true);
});

test('UT-7: a missing wall defaults to azimuth 0 (camera on +Z)', () => {
  const view = computeInitialView(computeCameraLimits(kitchen, LANDSCAPE));
  expect(view.azimuth).toBe(0);
  expect(view.position.z).toBeGreaterThan(0);
});

test.each([
  [{ width: 0, depth: 8, height: 3 }, LANDSCAPE],
  [{ width: 12, depth: -1, height: 3 }, LANDSCAPE],
  [{ width: 12, depth: 8, height: Number.NaN }, LANDSCAPE],
  [undefined, LANDSCAPE],
  [kitchen, 0],
  [kitchen, -1],
  [kitchen, Number.NaN],
  [kitchen, Infinity],
])('UT-8: rejects invalid dimensions or aspect %p / %p', (dimensions, aspect) => {
  expect(() => computeCameraLimits(dimensions, aspect, 'NORTH')).toThrow(RangeError);
});
