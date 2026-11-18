import { Group, Vector3 } from 'three';
import { applyPlacement } from '../../../../src/visualization/scene/elements/placementTransform.js';

const placement = (position, rotation, scale = { x: 1, y: 1, z: 1 }) => ({
  position,
  rotation,
  scale,
});
const worldDirection = (root, local) =>
  local.clone().transformDirection(root.matrix).toArray().map(Math.round);

test('UT01 - applies T·R·S in degrees with the Euler order XYZ, including zero and negative values', () => {
  const root = new Group();
  expect(
    applyPlacement(
      root,
      placement(
        { x: 1, y: 0, z: -2 },
        { x: 0, y: 90, z: 0 },
        { x: 2, y: 1, z: 1 },
      ),
    ),
  ).toBe(true);
  expect(root.position.toArray()).toEqual([1, 0, -2]);
  expect(root.scale.toArray()).toEqual([2, 1, 1]);
  expect(root.rotation.order).toBe('XYZ');
  expect(root.rotation.y).toBeCloseTo(Math.PI / 2);
  // rotation.y = 90: local +X turns to NORTH (-Z), the +Z front to EAST (+X).
  expect(worldDirection(root, new Vector3(1, 0, 0))).toEqual([0, 0, -1]);
  expect(worldDirection(root, new Vector3(0, 0, 1))).toEqual([1, 0, 0]);
  expect(root.matrixAutoUpdate).toBe(false);

  applyPlacement(
    root,
    placement({ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: 30 }),
  );
  expect(root.rotation.toArray().slice(0, 3)).toEqual(
    [10, 20, 30].map((degrees) => (degrees * Math.PI) / 180),
  );

  for (const rotation of [
    { x: 0, y: -90, z: 0 },
    { x: 0, y: 0, z: 0 },
  ])
    expect(
      applyPlacement(root, placement({ x: -5.2, y: 0, z: 2.8 }, rotation)),
    ).toBe(true);
  expect(root.position.toArray()).toEqual([-5.2, 0, 2.8]);
});

test('keeps automatic matrix updates for dynamic parts', () => {
  const root = new Group();
  applyPlacement(root, placement({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), {
    isStatic: false,
  });
  expect(root.matrixAutoUpdate).toBe(true);
});

test.each([
  ['position NaN', placement({ x: NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })],
  [
    'rotation Infinity',
    placement({ x: 0, y: 0, z: 0 }, { x: 0, y: Infinity, z: 0 }),
  ],
  [
    'scale 0',
    placement({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 1 }),
  ],
  [
    'scale -1',
    placement(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: -1 },
    ),
  ],
  [
    'missing scale',
    { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
  ],
])('rejects an invalid placement: %s', (_, value) => {
  expect(applyPlacement(new Group(), value)).toBe(false);
});