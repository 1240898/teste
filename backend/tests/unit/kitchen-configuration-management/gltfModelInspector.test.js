import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { boxGlb } from '../../../scripts/generate-kitchen-demo-assets.js';
import { GltfModelInspector } from '../../../src/modules/kitchen-configuration-management/infrastructure/files/GltfModelInspector.js';

const inspector = new GltfModelInspector();
let directory;

beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'web06-gltf-'));
});
afterAll(() => rm(directory, { recursive: true, force: true }));

async function gltf(name, document) {
  const file = path.join(directory, name);
  await writeFile(file, JSON.stringify(document));
  return file;
}

const base = (material, extra = {}) => ({
  asset: { version: '2.0' },
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [
    {
      primitives: [
        {
          attributes: { POSITION: 0 },
          ...(material === undefined ? {} : { material: 0 }),
        },
      ],
    },
  ],
  accessors: [
    {
      min: [-0.5, 0, -0.3],
      max: [0.5, 0.1, 0.3],
      type: 'VEC3',
      count: 8,
      componentType: 5126,
    },
  ],
  materials: material === undefined ? [] : [material],
  textures: [{ source: 0 }, { source: 1 }],
  images: [
    { uri: 'data:image/png;base64,AA==' },
    { uri: 'data:image/png;base64,AA==' },
  ],
  ...extra,
});

describe('WEB06 GltfModelInspector (UT20)', () => {
  test('GLB with base colour + metallic-roughness textures', async () => {
    const file = path.join(directory, 'belt.glb');
    await writeFile(file, boxGlb({ x: 1, y: 0.1, z: 0.6 }, [60, 60, 60]));
    expect(await inspector.inspect(file)).toEqual({
      size: { x: 1, y: 0.1, z: 0.6 },
      embeddedTextureSet: true,
    });
  });

  test('GLB without textures', async () => {
    const file = path.join(directory, 'table.glb');
    await writeFile(
      file,
      boxGlb({ x: 1.6, y: 0.9, z: 0.8 }, [1, 2, 3], { textured: false }),
    );
    expect((await inspector.inspect(file)).embeddedTextureSet).toBe(false);
  });

  test('base colour only / primitive without material / missing image', async () => {
    const colourOnly = await gltf(
      'colour.gltf',
      base({ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }),
    );
    const noMaterial = await gltf('none.gltf', base(undefined));
    const missingImage = await gltf(
      'missing.gltf',
      base(
        {
          pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
          normalTexture: { index: 1 },
        },
        {
          images: [
            { uri: 'data:image/png;base64,AA==' },
            { uri: 'normal.png' },
          ],
        },
      ),
    );
    for (const file of [colourOnly, noMaterial, missingImage])
      expect((await inspector.inspect(file)).embeddedTextureSet).toBe(false);
  });

  test('scaled and translated child node: size is the transformed bounding box', async () => {
    const file = await gltf(
      'scaled.gltf',
      base(undefined, {
        nodes: [
          { children: [1], translation: [3, 0, 0] },
          { mesh: 0, scale: [2, 3, 1] },
        ],
      }),
    );
    expect((await inspector.inspect(file)).size).toEqual({
      x: 2,
      y: 0.3,
      z: 0.6,
    });
  });

  test('rejects a file that is not glTF / GLB', async () => {
    const file = path.join(directory, 'fake.glb');
    await writeFile(file, 'not a model');
    await expect(inspector.inspect(file)).rejects.toThrow('Not a GLB file');
  });
});