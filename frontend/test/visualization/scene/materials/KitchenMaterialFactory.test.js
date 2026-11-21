import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three';
import {
  createKitchenMaterialFactory,
  MissingTextureError,
} from '../../../../src/visualization/scene/materials/KitchenMaterialFactory.js';
import { MaterialBuildError } from '../../../../src/visualization/scene/materials/MaterialBuildError.js';

const allMaps = {
  colorMapAssetId: 'colour',
  roughnessMapAssetId: 'rough',
  normalMapAssetId: 'normal',
  bumpMapAssetId: 'bump',
};

function setup() {
  const textures = {
    colour: new Texture(),
    rough: new Texture(),
    normal: new Texture(),
    bump: new Texture(),
  };
  const assets = { getTexture: (id) => textures[id] };
  return { textures, assets, materials: createKitchenMaterialFactory(assets) };
}

test('T9 - creates a MeshStandardMaterial with the configured values and maps', () => {
  const { materials } = setup();
  const material = materials.create({
    colorMapAssetId: 'colour',
    roughnessMapAssetId: 'rough',
    color: '#8b5e3c',
    roughness: 0.72,
    metalness: 0.05,
  });
  expect(material.isMeshStandardMaterial).toBe(true);
  expect(material.color.getHexString()).toBe('8b5e3c');
  expect(material.roughness).toBe(0.72);
  expect(material.metalness).toBe(0.05);
  expect(material.map).toBeTruthy();
  expect(material.roughnessMap).toBeTruthy();
});

test('T9b - fills white / 1 / 0 so the maps are shown unchanged (BR 16)', () => {
  const { materials } = setup();
  const material = materials.create({
    colorMapAssetId: 'colour',
    normalMapAssetId: 'normal',
  });
  expect(material.color.getHexString()).toBe('ffffff');
  expect(material.roughness).toBe(1);
  expect(material.metalness).toBe(0);
});

test('T10 - applies normal and bump maps together', () => {
  const { materials } = setup();
  const material = materials.create(allMaps);
  expect(material.normalMap).toBeTruthy();
  expect(material.bumpMap).toBeTruthy();
});

test('T11 / T12 - every map is a repeating clone with the right colour space', () => {
  const { textures, materials } = setup();
  const material = materials.create(allMaps);
  const pairs = [
    [material.map, textures.colour, SRGBColorSpace],
    [material.roughnessMap, textures.rough, NoColorSpace],
    [material.normalMap, textures.normal, NoColorSpace],
    [material.bumpMap, textures.bump, NoColorSpace],
  ];
  for (const [map, source, colorSpace] of pairs) {
    expect(map).not.toBe(source);
    expect(map.source).toBe(source.source);
    expect(map.wrapS).toBe(RepeatWrapping);
    expect(map.wrapT).toBe(RepeatWrapping);
    expect(map.colorSpace).toBe(colorSpace);
  }
});

test('T13 - never changes the LoadedAssets textures', () => {
  const { textures, materials } = setup();
  const before = { ...textures.colour };
  materials.create(allMaps);
  materials.create({ ...allMaps, color: '#aa0000' });
  expect(textures.colour.wrapS).toBe(before.wrapS);
  expect(textures.colour.colorSpace).toBe(before.colorSpace);
});

test('T14 / T15 - releases only its materials and clones, once', () => {
  const { textures, materials } = setup();
  const material = materials.create(allMaps);
  const released = [];
  materials.dispose((resource) => released.push(resource));
  materials.dispose((resource) => released.push(resource));
  expect(released).toEqual([
    material,
    material.map,
    material.roughnessMap,
    material.normalMap,
    material.bumpMap,
  ]);
  for (const texture of Object.values(textures))
    expect(released).not.toContain(texture);
});

test('T16 - two factories are independent', () => {
  const { assets } = setup();
  const first = createKitchenMaterialFactory(assets);
  const second = createKitchenMaterialFactory(assets);
  const a = first.create(allMaps);
  const b = second.create(allMaps);
  expect(a).not.toBe(b);
  const released = [];
  first.dispose((resource) => released.push(resource));
  expect(released).not.toContain(b);
});

test('T37 - a configured map missing from LoadedAssets fails with its id', () => {
  const { materials } = setup();
  expect(() =>
    materials.create({ colorMapAssetId: 'colour', bumpMapAssetId: 'nope' }),
  ).toThrow(expect.objectContaining({ constructor: MissingTextureError, assetId: 'nope' }));
});

test('T38 - equal properties share one material; a different colour does not', () => {
  const { materials } = setup();
  const properties = { colorMapAssetId: 'colour', roughnessMapAssetId: 'rough' };
  const first = materials.create(properties);
  expect(materials.create({ ...properties })).toBe(first);
  expect(materials.create({ ...properties, color: '#ffffff' })).toBe(first);
  expect(materials.create({ ...properties, color: '#aa0000' })).not.toBe(first);
});

test('rejects an invalid material before creating anything (D1)', () => {
  const { materials } = setup();
  expect(() => materials.create({ colorMapAssetId: 'colour' })).toThrow(
    MaterialBuildError,
  );
  const released = [];
  materials.dispose((resource) => released.push(resource));
  expect(released).toEqual([]);
});

test('applies an override with maps to every mesh and releases only what it created', () => {
  const { textures, materials } = setup();
  const original = new MeshBasicMaterial();
  const root = new Group().add(
    new Mesh(new BoxGeometry(), original),
    new Group().add(new Mesh(new BoxGeometry(), original)),
  );
    materials.applyOverride(root, {
    colorMapAssetId: 'colour',
    normalMapAssetId: 'normal',
  });
  const meshes = [];
  root.traverse((object) => object.isMesh && meshes.push(object));
  const override = meshes[0].material;
  expect(override.isMeshStandardMaterial).toBe(true);
  expect(meshes.map((mesh) => mesh.material)).toEqual([override, override]);

  const released = [];
  materials.dispose((resource) => released.push(resource));
  expect(released).toEqual([override, override.map, override.normalMap]);
  expect(released).not.toContain(textures.colour);
    expect(released).not.toContain(original);
});

test('a scalar-only override tints clones that keep the model texture, and releases only the clones', () => {
  const { materials } = setup();
  const modelMap = new Texture();
  const original = new MeshStandardMaterial({ map: modelMap });
  const root = new Group().add(new Mesh(new BoxGeometry(), original));
  materials.applyOverride(root, { color: '#aa0000', roughness: 0.3 });
  const [mesh] = root.children;
  expect(mesh.material).not.toBe(original);
  expect(mesh.material.map).toBe(modelMap);
  expect(mesh.material.color.getHexString()).toBe('aa0000');
  expect(mesh.material.roughness).toBe(0.3);
  expect(original.color.getHexString()).toBe('ffffff');

  const released = [];
  materials.dispose((resource) => released.push(resource));
  expect(released).toEqual([mesh.material]);
});