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

const uvRange = (geometry, indices) => {
  const uv = geometry.getAttribute('uv');
  const us = indices.map((i) => uv.getX(i));
  const vs = indices.map((i) => uv.getY(i));
  return {
    u: Math.max(...us) - Math.min(...us),
    v: Math.max(...vs) - Math.min(...vs),
  };
};
const vertices = (geometry, keep) => {
  const normal = geometry.getAttribute('normal');
  const result = [];
  for (let i = 0; i < normal.count; i += 1)
    if (keep(normal.getX(i), normal.getY(i), normal.getZ(i))) result.push(i);
  return result;
};

test('T25 - a 4 x 1 x 0.9 m box has UVs in metres per face and the same bounding box', () => {
  const shapes = createProceduralShapeFactory();
  const box = shapes.geometry('BOX', { x: 4, y: 1, z: 0.9 });
  const front = uvRange(
    box,
    vertices(box, (nx, ny, nz) => nz > 0.5),
  );
  expect(front.u).toBeCloseTo(4); // repeats 4 times along the 4 m length
  expect(front.v).toBeCloseTo(1);
  const side = uvRange(
    box,
    vertices(box, (nx) => nx > 0.5),
  );
  expect(side.u).toBeCloseTo(0.9);
  expect(side.v).toBeCloseTo(1);
  const top = uvRange(
    box,
    vertices(box, (nx, ny) => ny > 0.5),
  );
  expect(top.u).toBeCloseTo(4);
  expect(top.v).toBeCloseTo(0.9);
  const { min, max } = box.boundingBox;
  [-2, 0, -0.45].forEach((value, i) =>
    expect(min.getComponent(i)).toBeCloseTo(value),
  );
  [2, 1, 0.45].forEach((value, i) =>
    expect(max.getComponent(i)).toBeCloseTo(value),
  );
});

test.each(['CYLINDER', 'SPHERE', 'DOME'])(
  'T26 - %s side UVs follow the perimeter and height in metres',
  (shape) => {
    const shapes = createProceduralShapeFactory();
    const size = { x: 1.2, y: 2, z: 0.8 };
    const geometry = shapes.geometry(shape, size);
    const side = uvRange(
      geometry,
      vertices(geometry, (nx, ny) => Math.abs(ny) < 0.99),
    );
    expect(side.u).toBeCloseTo((Math.PI * (1.2 + 0.8)) / 2);
    expect(side.v).toBeLessThanOrEqual(2 + 1e-6);
    expect(side.v).toBeGreaterThan(1);
    // Same shape and size: still one cached geometry.
    expect(shapes.geometry(shape, { ...size })).toBe(geometry);
  },
);

test('T26 - cylinder caps are planar in metres', () => {
  const shapes = createProceduralShapeFactory();
  const cylinder = shapes.geometry('CYLINDER', { x: 1.2, y: 2, z: 0.8 });
  const cap = uvRange(
    cylinder,
    vertices(cylinder, (nx, ny) => ny > 0.99),
  );
  expect(cap.u).toBeCloseTo(1.2);
  expect(cap.v).toBeCloseTo(0.8);
});
test.each(['CYLINDER', 'SPHERE', 'DOME'])(
  'uses placed circumference and height on a scaled %s',
  (shape) => {
    const geometry = createProceduralShapeFactory().geometry(
      shape,
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 4, z: 3 },
    );
    const sides =
      shape === 'CYLINDER'
        ? vertices(geometry, (nx, ny) => Math.abs(ny) < 0.5)
        : vertices(geometry, () => true);
    const range = uvRange(geometry, sides);
    // SphereGeometry offsets the pole UV by half a segment at the seam.
    expect(range.u).toBeGreaterThanOrEqual(Math.PI * 2.5 - 0.001);
    expect(range.u).toBeLessThan(Math.PI * 2.6);
    expect(range.v).toBeCloseTo(4);
    if (shape === 'CYLINDER') {
      const cap = uvRange(
        geometry,
        vertices(geometry, (nx, ny) => ny > 0.99),
      );
      expect(cap.u).toBeCloseTo(2);
      expect(cap.v).toBeCloseTo(3);
    }
  },
);
