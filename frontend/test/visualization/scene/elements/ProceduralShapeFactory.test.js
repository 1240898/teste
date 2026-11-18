import {
  createProceduralShapeFactory,
  ShapeError,
} from '../../../../src/visualization/scene/elements/ProceduralShapeFactory.js';

const size = { x: 2, y: 0.9, z: 0.8 };

test.each(['BOX', 'CYLINDER', 'SPHERE', 'DOME'])(
  'UT02 - %s has size as its bounding box and its origin at the bottom centre',
  (shape) => {
    const { min, max } = createProceduralShapeFactory().geometry(
      shape,
      size,
    ).boundingBox;
    for (const [value, expected] of [
      [min.x, -1],
      [min.y, 0],
      [min.z, -0.4],
      [max.x, 1],
      [max.y, 0.9],
      [max.z, 0.4],
    ])
      expect(value).toBeCloseTo(expected, 6);
  },
);

test('UT03 - shares a geometry per shape and size and releases each once', () => {
  const shapes = createProceduralShapeFactory();
  const first = shapes.geometry('BOX', size);
  expect(shapes.geometry('BOX', { ...size })).toBe(first);
  const other = shapes.geometry('BOX', { x: 1, y: 1, z: 1 });
  expect(other).not.toBe(first);
  const spies = [first, other].map((geometry) =>
    jest.spyOn(geometry, 'dispose'),
  );
  shapes.dispose();
  shapes.dispose();
  for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
});

test.each([
  ['PYRAMID', size, 'unknown-shape'],
  ['toString', size, 'unknown-shape'],
  ['BOX', { x: 1, y: 0, z: 1 }, 'invalid-number'],
  ['BOX', { x: 1, y: NaN, z: 1 }, 'invalid-number'],
  ['BOX', undefined, 'invalid-number'],
])('rejects %s %o', (shape, value, reason) => {
  expect(() => createProceduralShapeFactory().geometry(shape, value)).toThrow(
    expect.objectContaining({ constructor: ShapeError, reason }),
  );
});