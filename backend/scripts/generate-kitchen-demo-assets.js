/**
 * WEB06 - writes PLACEHOLDER kitchen model (GLB) and texture (PNG) files for
 * every manifest entry whose file does not exist yet, so that `npm run db:seed`
 * and the demonstration work before VIS02-VIS04 supply the real files.
 * Existing files are never overwritten (use --force to regenerate them).
 *
 * Models follow the modelling convention of usWEB06 2.4.3: GLB, metres, Y-up,
 * origin at the bottom centre of the footprint, belt travel along +X.
 */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { readKitchenAssetManifest } from '../src/modules/kitchen-configuration-management/infrastructure/seedKitchenAssets.js';
import { DEFAULT_ASSETS_DIRECTORY } from '../src/modules/kitchen-configuration-management/infrastructure/files/LocalKitchenAssetFileStore.js';
import { kitchenModelGlb } from './kitchen-models/index.js';

// --- PNG -------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** 8x8 RGB PNG with a light checker pattern of the given colour. */
export function png([r, g, b], size = 8) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = [0];
    for (let x = 0; x < size; x += 1) {
      const shade = (x + y) % 2 ? 0 : 12;
      row.push(
        Math.min(255, r + shade),
        Math.min(255, g + shade),
        Math.min(255, b + shade),
      );
    }
    rows.push(Buffer.from(row));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- GLB -------------------------------------------------------------------

const align4 = (buffer, fill = 0) =>
  buffer.length % 4
    ? Buffer.concat([buffer, Buffer.alloc(4 - (buffer.length % 4), fill)])
    : buffer;

/** Box of size {x, y, z}: origin at the bottom centre; optional embedded textures. */
export function boxGlb({ x, y, z }, colour, { textured = true } = {}) {
  const [hx, hz] = [x / 2, z / 2];
  // [normal, 4 corners] per face of the box.
  // prettier-ignore
  const faces = [
    [[1, 0, 0], [[hx, 0, hz], [hx, 0, -hz], [hx, y, -hz], [hx, y, hz]]],
    [[-1, 0, 0], [[-hx, 0, -hz], [-hx, 0, hz], [-hx, y, hz], [-hx, y, -hz]]],
    [[0, 1, 0], [[-hx, y, hz], [hx, y, hz], [hx, y, -hz], [-hx, y, -hz]]],
    [[0, -1, 0], [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz]]],
    [[0, 0, 1], [[-hx, 0, hz], [hx, 0, hz], [hx, y, hz], [-hx, y, hz]]],
    [[0, 0, -1], [[hx, 0, -hz], [-hx, 0, -hz], [-hx, y, -hz], [hx, y, -hz]]],
  ];
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  faces.forEach(([normal, corners], face) => {
    corners.forEach((corner) => {
      positions.push(...corner);
      normals.push(...normal);
    });
    uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
    const base = face * 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const parts = [
    Buffer.from(new Float32Array(positions).buffer),
    Buffer.from(new Float32Array(normals).buffer),
    Buffer.from(new Float32Array(uvs).buffer),
    align4(Buffer.from(new Uint16Array(indices).buffer)),
  ];
  if (textured) parts.push(align4(png(colour)), align4(png([0, 200, 0])));
  const bufferViews = [];
  let offset = 0;
  for (const [index, part] of parts.entries()) {
    const view = { buffer: 0, byteOffset: offset, byteLength: part.length };
    if (index < 3) view.target = 34962;
    if (index === 3) {
      view.target = 34963;
      view.byteLength = indices.length * 2;
    }
    bufferViews.push(view);
    offset += part.length;
  }
  const binary = Buffer.concat(parts);
  const material = {
    name: 'placeholder',
    pbrMetallicRoughness: {
      baseColorFactor: [...colour.map((value) => value / 255), 1],
      metallicFactor: 0.2,
      roughnessFactor: 0.7,
    },
  };
  const gltf = {
    asset: { version: '2.0', generator: 'LaPrizza WEB06 demo assets' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
          },
        ],
      },
    ],
    materials: [material],
    buffers: [{ byteLength: binary.length }],
    bufferViews,
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 24,
        type: 'VEC3',
        min: [-hx, 0, -hz],
        max: [hx, y, hz],
      },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 24, type: 'VEC2' },
      {
        bufferView: 3,
        componentType: 5123,
        count: indices.length,
        type: 'SCALAR',
      },
    ],
  };
  if (textured) {
    gltf.images = [
      { bufferView: 4, mimeType: 'image/png' },
      { bufferView: 5, mimeType: 'image/png' },
    ];
    gltf.samplers = [{}];
    gltf.textures = [
      { source: 0, sampler: 0 },
      { source: 1, sampler: 0 },
    ];
    material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
    material.pbrMetallicRoughness.metallicRoughnessTexture = { index: 1 };
  }
  const json = align4(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, binary]);
}

// --- placeholders of the manifest -------------------------------------------

// Size (metres), colour and whether the file carries a texture set.
const MODELS = {
  'AST-MDL-DISPENSER-01': [{ x: 0.6, y: 0.8, z: 0.6 }, [150, 150, 160]],
  'AST-MDL-CONVEYOR-01': [{ x: 1.0, y: 0.1, z: 0.6 }, [60, 60, 60]],
  'AST-MDL-ROBOT-ARM-01': [{ x: 0.4, y: 1.2, z: 0.4 }, [230, 140, 30]],
  'AST-MDL-OVEN-DOME-01': [{ x: 1.8, y: 1.6, z: 1.8 }, [170, 80, 50]],
  'AST-MDL-FRIDGE-01': [{ x: 0.9, y: 2.0, z: 0.8 }, [220, 220, 225]],
};
const TEXTURE_COLOURS = {
  NORMAL: [128, 128, 255],
  ROUGH: [140, 140, 140],
};
const textureColour = (id) => {
  const suffix = id.split('-').at(-1);
  if (TEXTURE_COLOURS[suffix]) return TEXTURE_COLOURS[suffix];
  if (id.includes('TILES')) return [200, 190, 170];
  if (id.includes('PLASTER')) return [235, 230, 220];
  if (id.includes('WOOD')) return [140, 95, 60];
  return [175, 180, 185];
};

async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function main() {
  const force = process.argv.includes('--force');
  const entries = await readKitchenAssetManifest();
  let written = 0;
  // VIS03 recipes embed existing maps. Restore missing maps before models.
  const ordered = [...entries].sort(
    (a, b) => Number(b.kind === 'TEXTURE') - Number(a.kind === 'TEXTURE'),
  );
  for (const entry of ordered) {
    const target = path.resolve(DEFAULT_ASSETS_DIRECTORY, entry.path);
    if (!target.startsWith(path.resolve(DEFAULT_ASSETS_DIRECTORY) + path.sep))
      throw new Error(`Unsafe asset path: ${entry.path}`);
    if (!force && (await exists(target))) continue;
    let content;
    if (entry.kind === 'MODEL') {
      // VIS02 equipment models come from their recipes (npm run kitchen:models).
      content = kitchenModelGlb(entry.id);
      const model = MODELS[entry.id];
      if (!content && !model) {
        console.warn(`No placeholder defined for ${entry.id}; skipped.`);
        continue;
      }
      if (!content) {
        const [size, colour, textured = true] = model;
        content = boxGlb(size, colour, { textured });
      }
    } else content = png(textureColour(entry.id));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    written += 1;
  }
  console.log(`Kitchen demo assets: ${written} placeholder file(s) written.`);
}

// Only when run as a script (tests import the generators).
if (process.argv[1]?.endsWith('generate-kitchen-demo-assets.js')) await main();
