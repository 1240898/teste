import { FrontSide, MeshStandardMaterial, Vector3 } from 'three';
import { buildKitchenRoom } from '../../../../src/visualization/scene/room/KitchenRoomBuilder.js';

function build() {
  const floorMaterial = new MeshStandardMaterial();
  const wallMaterial = new MeshStandardMaterial();
  const room = buildKitchenRoom({
    dimensions: { width: 12, depth: 8, height: 3.2 },
    floorMaterial,
    wallMaterial,
  });
  const byName = Object.fromEntries(
    room.group.children.map((mesh) => [mesh.name, mesh]),
  );
  return { room, byName, floorMaterial, wallMaterial };
}

const worldBox = (mesh) => {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix);
};
const round = (vector) =>
  vector.toArray().map((value) => Math.round(value * 1000) / 1000 + 0);
const facing = (mesh) =>
  round(new Vector3(0, 0, 1).transformDirection(mesh.matrix));

test('UT08 - floor and four inward walls with shadow flags and names', () => {
  const { room, byName, floorMaterial, wallMaterial } = build();
  expect(room.group.name).toBe('layout:room');
  expect(Object.keys(byName).sort()).toEqual([
    'room:floor',
    'room:wall:EAST',
    'room:wall:NORTH',
    'room:wall:SOUTH',
    'room:wall:WEST',
  ]);

  const floor = worldBox(byName['room:floor']);
  expect(round(floor.min)).toEqual([-6, 0, -4]);
  expect(round(floor.max)).toEqual([6, 0, 4]);
  expect(byName['room:floor'].material).toBe(floorMaterial);
  expect(byName['room:floor'].receiveShadow).toBe(true);

  const expected = {
    NORTH: { min: [-6, 0, -4], max: [6, 3.2, -4], facing: [0, 0, 1] },
    SOUTH: { min: [-6, 0, 4], max: [6, 3.2, 4], facing: [0, 0, -1] },
    EAST: { min: [6, 0, -4], max: [6, 3.2, 4], facing: [-1, 0, 0] },
    WEST: { min: [-6, 0, -4], max: [-6, 3.2, 4], facing: [1, 0, 0] },
  };
  for (const [wall, value] of Object.entries(expected)) {
    const mesh = byName[`room:wall:${wall}`];
    const box = worldBox(mesh);
    expect(round(box.min)).toEqual(value.min);
    expect(round(box.max)).toEqual(value.max);
    expect(facing(mesh)).toEqual(value.facing);
    expect(mesh.material).toBe(wallMaterial);
    expect(mesh.material.side).toBe(FrontSide);
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.castShadow).toBe(false);
    expect(mesh.matrixAutoUpdate).toBe(false);
  }
});

test('UT09 - UVs in metres and three owned geometries', () => {
  const { room, byName } = build();
  const range = (mesh) => {
    const uv = mesh.geometry.getAttribute('uv');
    const us = Array.from({ length: uv.count }, (_, index) => uv.getX(index));
    const vs = Array.from({ length: uv.count }, (_, index) => uv.getY(index));
    return [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  };
  const expectRange = (mesh, expected) =>
    range(mesh).forEach((value, index) =>
      expect(value).toBeCloseTo(expected[index], 5),
    );
  expectRange(byName['room:floor'], [0, 12, 0, 8]);
  expectRange(byName['room:wall:NORTH'], [0, 12, 0, 3.2]);
  expectRange(byName['room:wall:EAST'], [0, 8, 0, 3.2]);
  expect(new Set(room.geometries).size).toBe(3);
});