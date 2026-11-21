import { BoxGeometry, CylinderGeometry, SphereGeometry } from 'three';

// Unit shapes: bounding box 1 x 1 x 1 centred at the origin, except the dome,
// whose base is already at y = 0 (usVIS02 D4).
const UNIT_SHAPES = {
  BOX: () => new BoxGeometry(1, 1, 1),
  CYLINDER: () => new CylinderGeometry(0.5, 0.5, 1, 32),
  SPHERE: () => new SphereGeometry(0.5, 32, 16),
  DOME: () => new SphereGeometry(0.5, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2),
};

export const PROCEDURAL_SHAPES = Object.freeze(Object.keys(UNIT_SHAPES));

const UNIT_SCALE = Object.freeze({ x: 1, y: 1, z: 1 });

const isPositive = (value) => Number.isFinite(value) && value > 0;

/**
 * Writes UVs on the unit mesh using the placed dimensions (usVIS04 D13, replaces VIS02 D4),
 * so a RepeatWrapping texture repeats once per metre (SGRAI W6 slides 186,
 * 195, 199-201) instead of being stretched over a large shape.
 * - BOX: each face's 0-1 UVs times that face's two dimensions;
 * - CYLINDER / SPHERE / DOME sides: u x perimeter, v x height, with the
 *   elliptical perimeter approximated by PI * (x + z) / 2;
 * - CYLINDER caps: planar, unit x / z times the placed width / depth.
 * Only the uv attribute changes, so the bounding box is the same.
 */
function writeMetreUvs(geometry, shape, { x, y, z }) {
  const uv = geometry.getAttribute('uv');
  const normal = geometry.getAttribute('normal');
  const position = geometry.getAttribute('position');
  const perimeter = (Math.PI * (x + z)) / 2;
  for (let index = 0; index < uv.count; index += 1) {
    const u = uv.getX(index);
    const v = uv.getY(index);
    const ny = Math.abs(normal.getY(index));
    if (shape === 'BOX') {
      const nx = Math.abs(normal.getX(index));
      if (nx > 0.5) uv.setXY(index, u * z, v * y);
      else if (ny > 0.5) uv.setXY(index, u * x, v * z);
      else uv.setXY(index, u * x, v * y);
    } else if (shape === 'CYLINDER' && ny > 0.99) {
      uv.setXY(index, position.getX(index) * x, position.getZ(index) * z);
    } else {
      uv.setXY(index, u * perimeter, v * y);
    }
  }
  uv.needsUpdate = true;
}

export class ShapeError extends Error {
  constructor(reason) {
    super(`Invalid procedural shape (${reason})`);
    this.name = 'ShapeError';
    this.reason = reason;
  }
}

/**
 * Creates procedural geometries whose bounding box is exactly `size` with the
 * origin at the bottom centre (WEB06 2.4.3, usVIS02 BR 7). Identical shapes
 * share one geometry (BR 15). UVs are in metres (usVIS04 D13). The factory
 * owns every geometry it returns.
 */
export function createProceduralShapeFactory() {
  const cache = new Map();

  return {
    geometry(shape, size, scale = UNIT_SCALE) {
      const makeUnit = Object.hasOwn(UNIT_SHAPES, shape)
        ? UNIT_SHAPES[shape]
        : undefined;
      if (!makeUnit) throw new ShapeError('unknown-shape');
      const { x, y, z } = size ?? {};
      if (![x, y, z].every(isPositive)) throw new ShapeError('invalid-number');

      const placed = { x: x * scale?.x, y: y * scale?.y, z: z * scale?.z };
      if (
        ![scale?.x, scale?.y, scale?.z, ...Object.values(placed)].every(
          isPositive,
        )
      )
        throw new ShapeError('invalid-number');
      const key = `${shape}|${x}|${y}|${z}|${scale.x}|${scale.y}|${scale.z}`;
      let geometry = cache.get(key);
      if (!geometry) {
        geometry = makeUnit();
        writeMetreUvs(geometry, shape, placed);
        if (shape === 'DOME') geometry.scale(x, y * 2, z);
        else geometry.scale(x, y, z).translate(0, y / 2, 0);
        geometry.computeBoundingBox();
        cache.set(key, geometry);
      }
      return geometry;
    },

    /** Releases every cached geometry once; safe to call twice. */
    dispose(release = (resource) => resource.dispose()) {
      for (const geometry of cache.values()) release(geometry);
      cache.clear();
    },
  };
}
