/**
 * Wall coordinates of the assembly line (usWEB06 2.4.2 / 2.4.3), as seen by a
 * person inside the kitchen facing the wall. Scene: metres, Y-up, origin at the
 * centre of the floor, -Z = NORTH.
 *   u = left -> right along the wall, d = distance from the wall.
 * Pure: no I/O, no state besides the wall and the kitchen dimensions.
 */
const FRAMES = Object.freeze({
  NORTH: {
    u: (p) => p.x,
    d: (p, k) => p.z + k.depth / 2,
    along: [0, 180],
  },
  SOUTH: {
    u: (p) => -p.x,
    d: (p, k) => k.depth / 2 - p.z,
    along: [0, 180],
  },
  EAST: {
    u: (p) => p.z,
    d: (p, k) => k.width / 2 - p.x,
    along: [90, 270],
  },
  WEST: {
    u: (p) => -p.z,
    d: (p, k) => p.x + k.width / 2,
    along: [90, 270],
  },
});

const EPSILON = 1e-9;

/** Rotation in degrees normalised to [0, 360). */
export function normaliseDegrees(value) {
  const result = ((value % 360) + 360) % 360;
  return Math.abs(result - 360) < EPSILON ? 0 : result;
}

export function isRightAngle(value) {
  const normalised = normaliseDegrees(value);
  return Math.abs(normalised / 90 - Math.round(normalised / 90)) < EPSILON;
}

export class AssemblyLineFrame {
  /** Maximum gap between the belt and the platform / oven (metres). */
  static GAP_TOLERANCE = 0.05;
  /** Maximum difference between the belt top and the platform top (metres). */
  static LEVEL_TOLERANCE = 0.15;

  #frame;
  #dimensions;

  constructor(wall, dimensions) {
    const frame = FRAMES[wall];
    if (!frame) throw new TypeError(`Unknown kitchen wall: ${wall}`);
    this.wall = wall;
    this.#frame = frame;
    this.#dimensions = { width: dimensions.width, depth: dimensions.depth };
    Object.freeze(this);
  }

  static of(wall, dimensions) {
    return new AssemblyLineFrame(wall, dimensions);
  }

  u(position) {
    return this.#frame.u(position, this.#dimensions) + 0;
  }

  d(position) {
    return this.#frame.d(position, this.#dimensions) + 0;
  }

  /** True when the element's +X axis is parallel to the wall. */
  isAlongWall(rotationY) {
    const normalised = normaliseDegrees(rotationY);
    return this.#frame.along.some(
      (angle) => Math.abs(normalised - angle) < EPSILON,
    );
  }

  /**
   * Footprint of an element aligned with the wall (rotation.y multiple of 90°).
   * @param {{position: {x,y,z}, rotation: {x,y,z}, scale: {x,y,z}}} placement
   * @param {{x: number, y: number, z: number}} size Size at scale 1 (metres).
   * @returns {{uMin, uMax, dMin, dMax, bottom, top}}
   */
  span(placement, size) {
    const sx = size.x * placement.scale.x;
    const sy = size.y * placement.scale.y;
    const sz = size.z * placement.scale.z;
    const along = this.isAlongWall(placement.rotation.y);
    const lenU = along ? sx : sz;
    const lenD = along ? sz : sx;
    const u = this.u(placement.position);
    const d = this.d(placement.position);
    return Object.freeze({
      uMin: u - lenU / 2,
      uMax: u + lenU / 2,
      dMin: d - lenD / 2,
      dMax: d + lenD / 2,
      bottom: placement.position.y,
      top: placement.position.y + sy,
    });
  }
}