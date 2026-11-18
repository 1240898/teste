import {
  Group,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three';
import {
  createKitchenMaterialFactory,
  MissingTextureError,
} from '../../../../src/visualization/scene/materials/KitchenMaterialFactory.js';

function setup() {
  const textures = { colour: new Texture(), normal: new Texture() };
  const assets = { getTexture: (id) => textures[id] };
  return { textures, assets, materials: createKitchenMaterialFactory(assets) };
}

test('creates PBR materials, clones only the colour map and caches equal properties', () => {
  const { textures, materials } = setup();
  const properties = {
    colorMapAssetId: 'colour',
    normalMapAssetId: 'normal',
    metalness: 0.8,
  };
  const material = materials.create(properties);
  expect(material.isMeshStandardMaterial).toBe(true);
  expect(material.metalness).toBe(0.8);
  expect(material.map).not.toBe(textures.colour);
  expect(material.map.source).toBe(textures.colour.source);
  expect(material.map.colorSpace).toBe(SRGBColorSpace);
  expect(material.normalMap).toBe(textures.normal);
  expect(materials.create({ ...properties })).toBe(material);
});

test('room surfaces get repeating clones for UVs in metres', () => {
  const { textures, materials } = setup();
  const material = materials.create(
    { normalMapAssetId: 'normal' },
    { worldScaleUv: true },
  );
  expect(material.normalMap).not.toBe(textures.normal);
  expect(material.normalMap.wrapS).toBe(RepeatWrapping);
  expect(material.normalMap.wrapT).toBe(RepeatWrapping);
  expect(textures.normal.wrapS).not.toBe(RepeatWrapping);
});

test('applies an override to every mesh and releases only what it created', () => {
  const { textures, materials } = setup();
  const original = new MeshBasicMaterial();
  const root = new Group().add(
    new Mesh(new BoxGeometry(), original),
    new Group().add(new Mesh(new BoxGeometry(), original)),
  );
  const override = materials.applyOverride(root, { colorMapAssetId: 'colour' });
  const meshes = [];
  root.traverse((object) => object.isMesh && meshes.push(object));
  expect(meshes.map((mesh) => mesh.material)).toEqual([override, override]);

  const released = [];
  materials.dispose((resource) => released.push(resource));
  expect(released).toEqual([override, override.map]);
  expect(released).not.toContain(textures.colour);
  expect(released).not.toContain(original);
});

test('reports a missing texture', () => {
  const { materials } = setup();
  expect(() => materials.create({ bumpMapAssetId: 'nope' })).toThrow(
    MissingTextureError,
  );
});