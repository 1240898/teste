/**
 * Minimal mesh builder for the kitchen models: flat-shaded convex blocks
 * (boxes, tapered boxes), cylinders and domes. Every triangle is wound so that
 * its face points along the supplied outward normal.
 */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (v) => {
  const length = Math.hypot(...v) || 1;
  return v.map((value) => value / length);
};

export class MeshData {
  positions = [];
  normals = [];
  uvs = [];
  indices = [];

  vertex(position, normal, uv) {
    this.positions.push(...position);
    this.normals.push(...normalize(normal));
    this.uvs.push(...uv);
    return this.positions.length / 3 - 1;
  }

  /** Triangle a, b, c wound to face `outward`. */
  triangle(a, b, c, outward) {
    const p = (index) => this.positions.slice(index * 3, index * 3 + 3);
    const face = cross(sub(p(b), p(a)), sub(p(c), p(a)));
    if (dot(face, outward) >= 0) this.indices.push(a, b, c);
    else this.indices.push(a, c, b);
  }

  /** Flat quad with corners in order, facing away from `inside`. */
  quad(corners, inside) {
    const [a, b, c] = corners;
    let normal = normalize(cross(sub(b, a), sub(c, a)));
    const centre = corners
      .reduce(
        (sum, corner) => sum.map((value, i) => value + corner[i]),
        [0, 0, 0],
      )
      .map((value) => value / 4);
    if (dot(normal, sub(centre, inside)) < 0) normal = normal.map((v) => -v);
    const uv = [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ];
    const ids = corners.map((corner, i) => this.vertex(corner, normal, uv[i]));
    this.triangle(ids[0], ids[1], ids[2], normal);
    this.triangle(ids[0], ids[2], ids[3], normal);
  }

  bounds() {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.positions.length; i += 3)
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], this.positions[i + axis]);
        max[axis] = Math.max(max[axis], this.positions[i + axis]);
      }
    return { min, max };
  }

  get triangleCount() {
    return this.indices.length / 3;
  }
}

/**
 * Tapered block from a bottom rectangle to a top rectangle (both horizontal).
 * Rectangles are [xMin, xMax, zMin, zMax]; a box when they are equal.
 */
export function block(bottom, top, y0, y1) {
  const mesh = new MeshData();
  const ring = ([x0, x1, z0, z1], y) => [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ];
  const low = ring(bottom, y0);
  const high = ring(top, y1);
  const inside = [...low, ...high]
    .reduce(
      (sum, corner) => sum.map((value, i) => value + corner[i]),
      [0, 0, 0],
    )
    .map((value) => value / 8);
  mesh.quad([...low].reverse(), inside);
  mesh.quad(high, inside);
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    mesh.quad([low[i], low[j], high[j], high[i]], inside);
  }
  return mesh;
}

/** Axis-aligned box from its minimum and maximum corners. */
export function box([x0, y0, z0], [x1, y1, z1]) {
  return block([x0, x1, z0, z1], [x0, x1, z0, z1], y0, y1);
}

/**
 * Closed cylinder (or cone frustum when radiusTo differs) along an axis
 * ('x', 'y' or 'z') between `from` and `to`, centred on `centre` (the two
 * other coordinates).
 */
export function cylinder({
  axis = 'y',
  radius,
  radiusTo = radius,
  from,
  to,
  centre,
  segments = 24,
}) {
  const mesh = new MeshData();
  const point = (t, u, v) => {
    if (axis === 'x') return [t, centre[0] + u, centre[1] + v];
    if (axis === 'z') return [centre[0] + u, centre[1] + v, t];
    return [centre[0] + u, t, centre[1] + v];
  };
  const direction = (t, u, v) => {
    if (axis === 'x') return [t, u, v];
    if (axis === 'z') return [u, v, t];
    return [u, t, v];
  };
  const rim = (t, r) =>
    Array.from({ length: segments }, (_, k) => {
      const angle = (k / segments) * Math.PI * 2;
      return { u: Math.cos(angle) * r, v: Math.sin(angle) * r, angle, t };
    });

  const side = [rim(from, radius), rim(to, radiusTo)];
  const ids = side.map((ring, end) =>
    ring.map(({ u, v, angle, t }) =>
      mesh.vertex(point(t, u, v), direction(0, u, v), [
        angle / (Math.PI * 2),
        end,
      ]),
    ),
  );
  for (let k = 0; k < segments; k += 1) {
    const next = (k + 1) % segments;
    const { u, v } = side[0][k];
    const outward = direction(0, u, v);
    mesh.triangle(ids[0][k], ids[0][next], ids[1][next], outward);
    mesh.triangle(ids[0][k], ids[1][next], ids[1][k], outward);
  }
  for (const [t, r, sign] of [
    [from, radius, Math.sign(from - to) || -1],
    [to, radiusTo, Math.sign(to - from) || 1],
  ]) {
    const normal = direction(sign, 0, 0);
    const middle = mesh.vertex(point(t, 0, 0), normal, [0.5, 0.5]);
    const cap = rim(t, r).map(({ u, v }) =>
      mesh.vertex(point(t, u, v), normal, [
        0.5 + u / (2 * r),
        0.5 + v / (2 * r),
      ]),
    );
    for (let k = 0; k < segments; k += 1)
      mesh.triangle(middle, cap[k], cap[(k + 1) % segments], normal);
  }
  return mesh;
}

/** Upper half of an ellipsoid standing on y0 (open bottom). */
export function dome({
  radiusX,
  radiusZ,
  height,
  y0,
  centre = [0, 0],
  segments = 32,
  rings = 10,
}) {
  const mesh = new MeshData();
  const grid = [];
  for (let r = 0; r <= rings; r += 1) {
    const phi = (r / rings) * (Math.PI / 2);
    const row = [];
    for (let k = 0; k <= segments; k += 1) {
      const theta = (k / segments) * Math.PI * 2;
      const x = Math.cos(phi) * Math.cos(theta);
      const z = Math.cos(phi) * Math.sin(theta);
      const y = Math.sin(phi);
      row.push(
        mesh.vertex(
          [centre[0] + x * radiusX, y0 + y * height, centre[1] + z * radiusZ],
          [x / radiusX, y / height, z / radiusZ],
          [k / segments, r / rings],
        ),
      );
    }
    grid.push(row);
  }
  const position = (index) => mesh.positions.slice(index * 3, index * 3 + 3);
  for (let r = 0; r < rings; r += 1)
    for (let k = 0; k < segments; k += 1) {
      const [a, b, c, d] = [
        grid[r][k],
        grid[r][k + 1],
        grid[r + 1][k + 1],
        grid[r + 1][k],
      ];
      const outward = sub(position(a), [centre[0], y0, centre[1]]);
      if (r < rings - 1 || a !== d) mesh.triangle(a, b, c, outward);
      mesh.triangle(a, c, d, outward);
    }
  return mesh;
}

/** Joins several meshes into one (one glTF primitive per part). */
export function merge(...meshes) {
  const result = new MeshData();
  for (const mesh of meshes) {
    const offset = result.positions.length / 3;
    result.positions.push(...mesh.positions);
    result.normals.push(...mesh.normals);
    result.uvs.push(...mesh.uvs);
    result.indices.push(...mesh.indices.map((index) => index + offset));
  }
  return result;
}