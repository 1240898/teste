import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const IDENTITY = Object.freeze([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

/** Column-major 4x4 product a * b (glTF matrices are column-major). */
function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1)
    for (let row = 0; row < 4; row += 1)
      for (let k = 0; k < 4; k += 1)
        out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
  return out;
}

function nodeMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16)
    return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  // prettier-ignore
  const xx = qx * qx, yy = qy * qy, zz = qz * qz,
    xy = qx * qy, xz = qx * qz, yz = qy * qz,
    wx = qw * qx, wy = qw * qy, wz = qw * qz;
  // prettier-ignore
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function transformPoint(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

const round = (value) => Math.round(value * 1000) / 1000;

/**
 * Reads only the glTF JSON (the GLB JSON chunk) of a model file, no rendering
 * (D19, D20):
 *  - size: scene bounding box (POSITION accessor min / max, node transforms applied);
 *  - embeddedTextureSet: every mesh primitive has a material with a
 *    baseColorTexture AND a metallicRoughnessTexture or normalTexture, and
 *    every referenced image is present (embedded, data URI or file next to it).
 */
export class GltfModelInspector {
  async inspect(absolutePath) {
    const gltf = await this.#readJson(absolutePath);
    const size = this.#boundingBoxSize(gltf);
    const embeddedTextureSet = await this.#hasTextureSet(gltf, absolutePath);
    return { size, embeddedTextureSet };
  }

  async #readJson(absolutePath) {
    const buffer = await readFile(absolutePath);
    if (absolutePath.toLowerCase().endsWith('.gltf'))
      return JSON.parse(buffer.toString('utf8'));
    if (buffer.length < 20 || buffer.readUInt32LE(0) !== GLB_MAGIC)
      throw new Error(`Not a GLB file: ${path.basename(absolutePath)}`);
    if (buffer.readUInt32LE(4) !== 2)
      throw new Error(
        `Unsupported glTF version: ${path.basename(absolutePath)}`,
      );
    const chunkLength = buffer.readUInt32LE(12);
    if (
      buffer.readUInt32LE(16) !== JSON_CHUNK ||
      20 + chunkLength > buffer.length
    )
      throw new Error(`Invalid GLB JSON chunk: ${path.basename(absolutePath)}`);
    return JSON.parse(buffer.subarray(20, 20 + chunkLength).toString('utf8'));
  }

  #boundingBoxSize(gltf) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const nodes = gltf.nodes ?? [];
    const visit = (index, parent, depth) => {
      const node = nodes[index];
      if (!node || depth > 64) return;
      const matrix = multiply(parent, nodeMatrix(node));
      const mesh = Number.isInteger(node.mesh)
        ? gltf.meshes?.[node.mesh]
        : null;
      for (const primitive of mesh?.primitives ?? []) {
        const accessor = gltf.accessors?.[primitive.attributes?.POSITION];
        if (!accessor?.min || !accessor?.max) continue;
        for (const corner of corners(accessor.min, accessor.max)) {
          const point = transformPoint(matrix, corner);
          for (let axis = 0; axis < 3; axis += 1) {
            min[axis] = Math.min(min[axis], point[axis]);
            max[axis] = Math.max(max[axis], point[axis]);
          }
        }
      }
      for (const child of node.children ?? []) visit(child, matrix, depth + 1);
    };
    const scene = gltf.scenes?.[gltf.scene ?? 0];
    const roots = scene?.nodes ?? nodes.map((_, index) => index);
    for (const root of roots) visit(root, IDENTITY, 0);
    if (!Number.isFinite(min[0]))
      throw new Error('The model has no mesh with POSITION bounds');
    return {
      x: round(max[0] - min[0]),
      y: round(max[1] - min[1]),
      z: round(max[2] - min[2]),
    };
  }

  async #hasTextureSet(gltf, absolutePath) {
    const primitives = (gltf.meshes ?? []).flatMap(
      (mesh) => mesh.primitives ?? [],
    );
    if (!primitives.length) return false;
    const textureIndices = new Set();
    for (const primitive of primitives) {
      const material = gltf.materials?.[primitive.material];
      if (!material) return false;
      const baseColour = material.pbrMetallicRoughness?.baseColorTexture;
      const roughness = material.pbrMetallicRoughness?.metallicRoughnessTexture;
      const normal = material.normalTexture;
      if (!baseColour || !(roughness || normal)) return false;
      for (const info of [baseColour, roughness, normal])
        if (info) textureIndices.add(info.index);
    }
    for (const index of textureIndices) {
      const texture = gltf.textures?.[index];
      const image = gltf.images?.[texture?.source];
      if (!image || !(await this.#imagePresent(gltf, image, absolutePath)))
        return false;
    }
    return true;
  }

  async #imagePresent(gltf, image, absolutePath) {
    if (Number.isInteger(image.bufferView))
      return Boolean(gltf.bufferViews?.[image.bufferView]);
    if (typeof image.uri !== 'string' || !image.uri) return false;
    if (image.uri.startsWith('data:')) return true;
    const directory = path.dirname(absolutePath);
    const target = path.resolve(directory, decodeURIComponent(image.uri));
    if (!target.startsWith(directory + path.sep)) return false;
    try {
      await access(target);
      return true;
    } catch {
      return false;
    }
  }
}

function corners([x0, y0, z0], [x1, y1, z1]) {
  // prettier-ignore
  return [
    [x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x0, y0, z1],
    [x1, y1, z0], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1],
  ];
}