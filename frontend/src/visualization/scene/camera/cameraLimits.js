import {
  FIT_MARGIN,
  FOV_DEGREES,
  INITIAL_POLAR_DEGREES,
  MAX_DISTANCE_FACTOR,
  MIN_DISTANCE,
  NEAR,
  WALL_AZIMUTH_DEGREES,
  toRadians,
} from './cameraSettings.js';

const positive = (value) => Number.isFinite(value) && value > 0;

function assertDimensions(dimensions) {
  const { width, depth, height } = dimensions ?? {};
  if (![width, depth, height].every(positive))
    throw new RangeError('Kitchen dimensions must be finite and greater than 0');
  return { width, depth, height };
}

function assertAspect(aspect) {
  if (!positive(aspect))
    throw new RangeError('Aspect ratio must be finite and greater than 0');
  return aspect;
}

/** Azimuth (radians) of the camera opposite the assembly-line wall (D11). */
export const azimuthForWall = (wall) =>
  toRadians(WALL_AZIMUTH_DEGREES[wall] ?? 0);

/**
 * Smallest distance from the target (origin) at which the eight corners of the
 * kitchen (±w/2, 0 | h, ±d/2) are inside the view, for the given direction and
 * canvas aspect ratio, times `margin` (usVIS07 2.4.1, BR 2, D11).
 *
 * u = unit vector target -> camera; right / up = camera axes (as Object3D.lookAt
 * builds them with world up +Y). A corner c is visible at distance D when
 *   D >= c·u + |c·right| / tan(hFov / 2)   and   D >= c·u + |c·up| / tan(vFov / 2)
 *
 * Pure: numbers only, no Three.js objects, no React.
 */
export function computeFitDistance(
  dimensions,
  aspect,
  azimuth,
  polar,
  margin = FIT_MARGIN,
) {
  const { width, depth, height } = assertDimensions(dimensions);
  assertAspect(aspect);

  const tanV = Math.tan(toRadians(FOV_DEGREES) / 2);
  const tanH = tanV * aspect; // tan(hFov / 2) = tan(vFov / 2) * aspect
  const sinP = Math.sin(polar);
  const u = [sinP * Math.sin(azimuth), Math.cos(polar), sinP * Math.cos(azimuth)];
  const right = [Math.cos(azimuth), 0, -Math.sin(azimuth)]; // normalize(up × u)
  const up = [
    u[1] * right[2] - u[2] * right[1],
    u[2] * right[0] - u[0] * right[2],
    u[0] * right[1] - u[1] * right[0],
  ]; // u × right
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  let fit = 0;
  for (const x of [-width / 2, width / 2])
    for (const y of [0, height])
      for (const z of [-depth / 2, depth / 2]) {
        const corner = [x, y, z];
        const along = dot(corner, u);
        fit = Math.max(
          fit,
          along + Math.abs(dot(corner, right)) / tanH,
          along + Math.abs(dot(corner, up)) / tanV,
        );
      }
  return margin * fit;
}

/**
 * Camera limits for the active kitchen and the current canvas aspect ratio
 * (usVIS07 2.4.1, BR 2, BR 4, BR 6, BR 7). Pure: no Three.js objects, no React.
 *
 * @param {{ width: number, depth: number, height: number }} dimensions metres
 * @param {number} aspect canvas width / height
 * @param {'NORTH' | 'SOUTH' | 'EAST' | 'WEST'} [wall] assembly-line wall
 */
export function computeCameraLimits(dimensions, aspect, wall) {
  const { width, depth, height } = assertDimensions(dimensions);
  assertAspect(aspect);

  const fitDistance = computeFitDistance(
    { width, depth, height },
    aspect,
    azimuthForWall(wall),
    toRadians(INITIAL_POLAR_DEGREES),
  );
  const maxDistance = MAX_DISTANCE_FACTOR * fitDistance;

  return Object.freeze({
    aspect,
    fitDistance,
    minDistance: MIN_DISTANCE,
    maxDistance,
    near: NEAR,
    far: maxDistance + Math.hypot(width, depth, height),
    targetBounds: Object.freeze({
      minX: -width / 2,
      maxX: width / 2,
      minZ: -depth / 2,
      maxZ: depth / 2,
    }),
  });
}

/**
 * Initial view (BR 2, D11): target at the centre of the floor, distance
 * fitDistance, polar 55 deg, camera opposite the assembly-line wall.
 *
 * @param {ReturnType<typeof computeCameraLimits>} limits
 * @param {'NORTH' | 'SOUTH' | 'EAST' | 'WEST'} [wall]
 */
export function computeInitialView(limits, wall) {
  const azimuth = azimuthForWall(wall);
  const polar = toRadians(INITIAL_POLAR_DEGREES);
  const distance = limits.fitDistance;
  const horizontal = distance * Math.sin(polar);
  return Object.freeze({
    target: Object.freeze({ x: 0, y: 0, z: 0 }),
    azimuth,
    polar,
    distance,
    position: Object.freeze({
      x: horizontal * Math.sin(azimuth),
      y: distance * Math.cos(polar),
      z: horizontal * Math.cos(azimuth),
    }),
  });
}
