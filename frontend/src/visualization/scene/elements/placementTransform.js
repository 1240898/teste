import { MathUtils } from 'three';

const AXES = ['x', 'y', 'z'];

function readVector(vector, isValid) {
  if (vector === null || typeof vector !== 'object') return undefined;
  const values = AXES.map((axis) => vector[axis]);
  return values.every(isValid) ? values : undefined;
}

const isFiniteNumber = (value) => Number.isFinite(value);
const isPositive = (value) => Number.isFinite(value) && value > 0;

/**
 * Reads a WEB06 placement (usVIS02 BR 6, BR 11). Position and rotation only
 * need to be finite: zero and negative values are valid. Scale must be > 0.
 * @returns {{position: number[], rotation: number[], scale: number[]} | undefined}
 */
export function readPlacement(placement) {
  const position = readVector(placement?.position, isFiniteNumber);
  const rotation = readVector(placement?.rotation, isFiniteNumber);
  const scale = readVector(placement?.scale, isPositive);
  if (!position || !rotation || !scale) return undefined;
  return { position, rotation, scale };
}

/**
 * Applies translation, rotation (degrees, Euler order XYZ) and scale to the
 * element root. Static roots keep their matrix and skip per-frame updates.
 * @returns {boolean} false when the placement is not valid
 */
export function applyPlacement(root, placement, { isStatic = true } = {}) {
  const values = readPlacement(placement);
  if (!values) return false;
  const [rx, ry, rz] = values.rotation.map((degrees) =>
    MathUtils.degToRad(degrees),
  );
  root.position.set(...values.position);
  root.rotation.set(rx, ry, rz, 'XYZ');
  root.scale.set(...values.scale);
  root.updateMatrix();
  root.matrixAutoUpdate = !isStatic;
  return true;
}