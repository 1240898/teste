import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
} from 'three';
import { MaterialApplicationHelper } from '../../../../src/visualization/scene/materials/MaterialApplicationHelper.js';

const meshesOf = (root) => {
  const meshes = [];
  root.traverse((object) => object.isMesh && meshes.push(object));
  return meshes;
};

test('T17 - with maps, every mesh gets the material; groups, geometry and UVs untouched', () => {
  const geometry = new BoxGeometry();
  const uv = geometry.getAttribute('uv');
  const inner = new Group();
  const root = new Group().add(
    new Mesh(geometry, new MeshStandardMaterial()),
    inner.add(new Mesh(geometry, new MeshStandardMaterial())),
  );
  const material = new MeshStandardMaterial();
  MaterialApplicationHelper.applyToMeshes(root, material);
  for (const mesh of meshesOf(root)) {
    expect(mesh.material).toBe(material);
    expect(mesh.geometry).toBe(geometry);
  }
  expect(geometry.getAttribute('uv')).toBe(uv);
  expect(inner.material).toBeUndefined();
});

test('T18 - scalars only: each mesh gets a tinted clone with the same map; originals unchanged', () => {
  const map = new Texture();
  const a = new MeshStandardMaterial({ map, roughness: 0.6 });
  const b = new MeshStandardMaterial({ map });
  const root = new Group().add(
    new Mesh(new BoxGeometry(), a),
    new Mesh(new BoxGeometry(), b),
  );
  const clones = MaterialApplicationHelper.tintMeshes(root, { color: '#aa0000' });
  expect(clones).toHaveLength(2);
  for (const mesh of meshesOf(root)) {
    expect([a, b]).not.toContain(mesh.material);
    expect(mesh.material.color.getHexString()).toBe('aa0000');
    expect(mesh.material.map).toBe(map);
  }
  // Absent scalars are not filled (BR 16): roughness stays the model's own.
  expect(meshesOf(root)[0].material.roughness).toBe(0.6);
  expect(a.color.getHexString()).toBe('ffffff');
  expect(b.color.getHexString()).toBe('ffffff');
});

test('T19 - arrays of materials: the rule is applied to every entry', () => {
  const first = new MeshStandardMaterial();
  const second = new MeshStandardMaterial();
  const replaced = new Mesh(new BoxGeometry(), [first, second]);
  const replacement = new MeshStandardMaterial();
  MaterialApplicationHelper.applyToMeshes(new Group().add(replaced), replacement);
  expect(replaced.material).toEqual([replacement, replacement]);

  const tinted = new Mesh(new BoxGeometry(), [first, second]);
  const clones = MaterialApplicationHelper.tintMeshes(new Group().add(tinted), {
    metalness: 0.9,
  });
  expect(clones).toHaveLength(2);
  expect(tinted.material).toEqual(clones);
  expect(tinted.material.map((m) => m.metalness)).toEqual([0.9, 0.9]);
  expect([first.metalness, second.metalness]).toEqual([0, 0]);
});

test('T36 - two meshes that share a material share one tinted clone', () => {
  const shared = new MeshStandardMaterial();
  const root = new Group().add(
    new Mesh(new BoxGeometry(), shared),
    new Mesh(new BoxGeometry(), shared),
  );
  const clones = MaterialApplicationHelper.tintMeshes(root, { color: '#336699' });
  expect(clones).toHaveLength(1);
  const [x, y] = meshesOf(root);
  expect(x.material).toBe(clones[0]);
  expect(y.material).toBe(clones[0]);
});