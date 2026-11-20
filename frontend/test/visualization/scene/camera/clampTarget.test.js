
import { clampTarget } from '../../../../src/visualization/scene/camera/clampTarget.js';

const bounds = { minX: -6, maxX: 6, minZ: -4, maxZ: 4 };

test('leaves a target inside the floor unchanged', () => {
  const target = { x: 1, y: 0, z: -2 };
  const camera = { x: 10, y: 8, z: 10 };
  expect(clampTarget(target, camera, bounds)).toBe(false);
  expect(target).toEqual({ x: 1, y: 0, z: -2 });
  expect(camera).toEqual({ x: 10, y: 8, z: 10 });
});

test('holds the target at the boundary and moves the camera by the same correction', () => {
  const target = { x: 9, y: 0, z: -7 };
  const camera = { x: 19, y: 8, z: 3 };
  expect(clampTarget(target, camera, bounds)).toBe(true);
  expect(target).toEqual({ x: 6, y: 0, z: -4 });
  expect(camera).toEqual({ x: 16, y: 8, z: 6 });
});

test('accepts a target exactly on the boundary', () => {
  expect(clampTarget({ x: 6, y: 0, z: 4 }, { x: 0, y: 5, z: 0 }, bounds)).toBe(false);
});

test('UT-12: mutates the given vectors in place (no new objects)', () => {
  const target = { x: 9, y: 0, z: 0 };
  const camera = { x: 19, y: 8, z: 0 };
  const [sameTarget, sameCamera] = [target, camera];
  clampTarget(target, camera, bounds);
  expect(target).toBe(sameTarget);
  expect(camera).toBe(sameCamera);
});
