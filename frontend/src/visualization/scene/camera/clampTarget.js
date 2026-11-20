const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Keeps the orbit target inside the floor rectangle (x / z, BR 4, D4). The
 * camera is moved by the same correction, so its distance and viewing
 * direction do not change: the view stops at the boundary without a jump.
 *
 * Mutates both vectors and allocates nothing (safe to call on every change).
 *
 * @param {{ x: number, z: number }} target orbit target (Vector3)
 * @param {{ x: number, z: number }} cameraPosition camera position (Vector3)
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} bounds
 * @returns {boolean} true when the target was clamped
 */
export function clampTarget(target, cameraPosition, bounds) {
  const x = clamp(target.x, bounds.minX, bounds.maxX);
  const z = clamp(target.z, bounds.minZ, bounds.maxZ);
  const dx = x - target.x;
  const dz = z - target.z;
  if (dx === 0 && dz === 0) return false;
  target.x = x;
  target.z = z;
  cameraPosition.x += dx;
  cameraPosition.z += dz;
  return true;
}