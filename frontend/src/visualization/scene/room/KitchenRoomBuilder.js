import { Group, Mesh, PlaneGeometry } from 'three';
import { LAYOUT_ROOM, ROOM_FLOOR, roomWall } from '../sceneObjectNames.js';

/** Scales the UVs of a plane so that 1 UV unit = 1 metre (usVIS02 D7). */
function metreUvs(geometry, width, height) {
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index += 1)
    uv.setXY(index, uv.getX(index) * width, uv.getY(index) * height);
  uv.needsUpdate = true;
  return geometry;
}

function place(mesh, name, [x, y, z], rotationY = 0) {
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.rotation.set(0, rotationY, 0);
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  return mesh;
}

/**
 * Floor and four walls of the kitchen (usVIS02 BR 5, D7): planes facing into
 * the room, single-sided, without ceiling. Seen from outside, the walls in
 * front of the camera are back faces and are not drawn. Floor and walls
 * receive shadows; the walls do not cast them.
 *
 * @returns {{group: Group, geometries: import('three').BufferGeometry[]}}
 */
export function buildKitchenRoom({ dimensions, floorMaterial, wallMaterial }) {
  const { width, depth, height } = dimensions;
  const group = new Group();
  group.name = LAYOUT_ROOM;

  const floorGeometry = metreUvs(new PlaneGeometry(width, depth), width, depth);
  floorGeometry.rotateX(-Math.PI / 2);
  // NORTH / SOUTH walls are as long as the width, EAST / WEST as the depth.
  const longWall = metreUvs(new PlaneGeometry(width, height), width, height);
  const shortWall = metreUvs(new PlaneGeometry(depth, height), depth, height);
  longWall.translate(0, height / 2, 0);
  shortWall.translate(0, height / 2, 0);

  const floor = place(
    new Mesh(floorGeometry, floorMaterial),
    ROOM_FLOOR,
    [0, 0, 0],
  );
  floor.receiveShadow = true;
  group.add(floor);

  // A plane faces +Z; each wall is turned so that its front faces the centre.
  const walls = [
    ['NORTH', longWall, [0, 0, -depth / 2], 0],
    ['SOUTH', longWall, [0, 0, depth / 2], Math.PI],
    ['EAST', shortWall, [width / 2, 0, 0], -Math.PI / 2],
    ['WEST', shortWall, [-width / 2, 0, 0], Math.PI / 2],
  ];
  for (const [wall, geometry, position, rotationY] of walls) {
    const mesh = place(
      new Mesh(geometry, wallMaterial),
      roomWall(wall),
      position,
      rotationY,
    );
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
  }

  return { group, geometries: [floorGeometry, longWall, shortWall] };
}