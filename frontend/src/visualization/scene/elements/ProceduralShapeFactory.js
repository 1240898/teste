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

const isPositive = (value) => Number.isFinite(value) && value > 0;

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
 * share one geometry (BR 15). The factory owns every geometry it returns.
 */
export function createProceduralShapeFactory() {
  const cache = new Map();

  return {
    geometry(shape, size) {
      const makeUnit = Object.hasOwn(UNIT_SHAPES, shape)
        ? UNIT_SHAPES[shape]
        : undefined;
      if (!makeUnit) throw new ShapeError('unknown-shape');
      const { x, y, z } = size ?? {};
      if (![x, y, z].every(isPositive)) throw new ShapeError('invalid-number');

      const key = `${shape}|${x}|${y}|${z}`;
      let geometry = cache.get(key);
      if (!geometry) {
        geometry = makeUnit();
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