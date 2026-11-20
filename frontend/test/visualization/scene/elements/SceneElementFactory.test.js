import {
  Bone,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Skeleton,
  SkinnedMesh,
  Texture,
} from 'three';
import { createKitchenMaterialFactory } from '../../../../src/visualization/scene/materials/KitchenMaterialFactory.js';
import { ElementBuildError } from '../../../../src/visualization/scene/elements/ElementBuildError.js';
import { createProceduralShapeFactory } from '../../../../src/visualization/scene/elements/ProceduralShapeFactory.js';
import { createSceneElementFactory } from '../../../../src/visualization/scene/elements/SceneElementFactory.js';

const identity = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

function setup() {
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const scene = new Group().add(new Mesh(geometry, material));
  const steel = new Texture();
  const model = { scene };
  const getModel = jest.fn((id) =>
    id === 'AST-MDL-FRIDGE-01' ? model : undefined,
  );
  const assets = {
    getModel,
    getTexture: (id) => (id === 'AST-TEX-STEEL-COLOR' ? steel : undefined),
  };
  const shapes = createProceduralShapeFactory();
  const materials = createKitchenMaterialFactory(assets);
  jest.spyOn(materials, 'applyOverride');
  const factory = createSceneElementFactory({ assets, shapes, materials });
  return { factory, assets, model, geometry, material, shapes, materials };
}

const element = (overrides) => ({
  id: 'element-1',
  name: 'Element',
  category: 'EQUIPMENT',
  type: 'COUNTER',
  placement: identity,
  ...overrides,
});
const meshesOf = (root) => {
  const meshes = [];
  root.traverse((object) => object.isMesh && meshes.push(object));
  return meshes;
};

test('UT04 - builds a procedural element with the cached geometry, its material and shadows', () => {
  const { factory, shapes } = setup();
  const counter = element({
    id: 'counter-1',
    model: {
      source: 'PROCEDURAL',
      shape: 'BOX',
      size: { x: 2.4, y: 0.9, z: 0.7 },
    },
    material: { colorMapAssetId: 'AST-TEX-STEEL-COLOR', metalness: 0.8 },
  });
  const root = factory.create(counter);
  expect(root.name).toBe('counter-1');
  expect(root.userData).toEqual({
    elementId: 'counter-1',
    category: 'EQUIPMENT',
    type: 'COUNTER',
    name: 'Element',
  });
  const [mesh] = meshesOf(root);
  expect(mesh.geometry).toBe(
    shapes.geometry('BOX', { x: 2.4, y: 0.9, z: 0.7 }),
  );
  expect(mesh.material.metalness).toBe(0.8);
  expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
});

test('UT05 - clones an imported model per element and borrows its resources', () => {
  const { factory, model, geometry, material } = setup();
  const fridge = (id) =>
    element({
      id,
      type: 'REFRIGERATOR',
      model: { source: 'ASSET', assetId: 'AST-MDL-FRIDGE-01' },
    });
  const first = factory.create(fridge('fridge-1'));
  const second = factory.create(fridge('fridge-2'));
  const [a] = meshesOf(first);
  const [b] = meshesOf(second);
  expect(a).not.toBe(b);
  expect(a).not.toBe(model.scene.children[0]);
  expect([a.geometry, b.geometry]).toEqual([geometry, geometry]);
  expect([a.material, b.material]).toEqual([material, material]);
  expect(model.scene.children).toHaveLength(1);
  expect(model.scene.children[0].castShadow).toBe(false);
});

test('UT06 - applies the material override only when the element has one', () => {
  const { factory, materials, material } = setup();
  const withOverride = factory.create(
    element({
      model: { source: 'ASSET', assetId: 'AST-MDL-FRIDGE-01' },
      material: { colorMapAssetId: 'AST-TEX-STEEL-COLOR' },
    }),
  );
  expect(materials.applyOverride).toHaveBeenCalledTimes(1);
  expect(meshesOf(withOverride)[0].material).not.toBe(material);
  const without = factory.create(
    element({
      id: 'plain',
      model: { source: 'ASSET', assetId: 'AST-MDL-FRIDGE-01' },
    }),
  );
  expect(materials.applyOverride).toHaveBeenCalledTimes(1);
  expect(meshesOf(without)[0].material).toBe(material);
});

test.each([
  [
    'shape PYRAMID',
    {
      model: {
        source: 'PROCEDURAL',
        shape: 'PYRAMID',
        size: { x: 1, y: 1, z: 1 },
      },
    },
    'unknown-shape',
  ],
  [
    'size.y 0',
    {
      model: { source: 'PROCEDURAL', shape: 'BOX', size: { x: 1, y: 0, z: 1 } },
    },
    'invalid-number',
  ],
  [
    'scale.x 0',
    { placement: { ...identity, scale: { x: 0, y: 1, z: 1 } } },
    'invalid-number',
  ],
  [
    'scale.z -1',
    { placement: { ...identity, scale: { x: 1, y: 1, z: -1 } } },
    'invalid-number',
  ],
  [
    'position NaN',
    { placement: { ...identity, position: { x: NaN, y: 0, z: 0 } } },
    'invalid-number',
  ],
  [
    'rotation Infinity',
    { placement: { ...identity, rotation: { x: 0, y: Infinity, z: 0 } } },
    'invalid-number',
  ],
  [
    'missing asset',
    { model: { source: 'ASSET', assetId: 'AST-MDL-NOPE' } },
    'asset-missing',
  ],
  [
    'texture as model',
    { model: { source: 'ASSET', assetId: 'AST-TEX-STEEL-COLOR' } },
    'asset-kind',
  ],
  [
    'missing texture',
    { material: { colorMapAssetId: 'AST-TEX-NOPE' } },
    'asset-missing',
  ],
])('UT07 - %s fails with the element id', (_, overrides, reason) => {
  const { factory } = setup();
  const value = element({
    id: 'broken-1',
    model: { source: 'PROCEDURAL', shape: 'BOX', size: { x: 1, y: 1, z: 1 } },
    ...overrides,
  });
  expect(() => factory.create(value)).toThrow(
    expect.objectContaining({
      constructor: ElementBuildError,
      elementId: 'broken-1',
      reason,
    }),
  );
});

test('never reads an asset URL', () => {
  const { factory, assets } = setup();
  const value = element({
    model: { source: 'ASSET', assetId: 'AST-MDL-FRIDGE-01' },
  });
  Object.defineProperty(value.model, 'url', {
    get: () => {
      throw new Error('url read');
    },
  });
  expect(() => factory.create(value)).not.toThrow();
  expect(assets.getModel).toHaveBeenCalledWith('AST-MDL-FRIDGE-01');
});

test('releases a detached clone skeleton if its material override fails', () => {
  const { model, geometry, material, assets, shapes, materials } = setup();
  const mesh = new SkinnedMesh(geometry, material);
  const bone = new Bone();
  mesh.add(bone);
  mesh.bind(new Skeleton([bone]));
  model.scene.clear().add(mesh);
  const release = jest.fn();
  const factory = createSceneElementFactory({
    assets,
    shapes,
    materials,
    disposeResource: release,
  });

  expect(() =>
    factory.create(
      element({
        model: { source: 'ASSET', assetId: 'AST-MDL-FRIDGE-01' },
        material: { colorMapAssetId: 'AST-TEX-MISSING' },
      }),
    ),
  ).toThrow(expect.objectContaining({ reason: 'asset-missing' }));
  expect(release).toHaveBeenCalledTimes(1);
  const [skeleton] = release.mock.calls[0];
  expect(skeleton).toBeInstanceOf(Skeleton);
  expect(skeleton).not.toBe(mesh.skeleton);
});

test('UT05b - parts of an imported model never shadow an element id (BR 3)', () => {
  const { factory, model } = setup();
  // The shipped fridge has a node called "door-upper", a valid element id too.
  model.scene.children[0].name = 'door-upper';
  const scene = new Scene();
  const fridge = factory.create(
    element({
      id: 'fridge-1',
      model: { source: 'ASSET', assetId: 'AST-MDL-FRIDGE-01' },
    }),
  );
  const door = factory.create(
    element({
      id: 'door-upper',
      model: { source: 'PROCEDURAL', shape: 'BOX', size: { x: 1, y: 1, z: 1 } },
    }),
  );
  scene.add(fridge, door); // the fridge is traversed first

  expect(scene.getObjectByName('door-upper')).toBe(door);
  const [part] = meshesOf(fridge);
  expect(part.name).toBe('part:door-upper');
  expect(part.userData.partName).toBe('door-upper');
  expect(fridge.getObjectByName('part:door-upper')).toBe(part);
  // The loaded model itself is not renamed (it is shared by every clone).
  expect(model.scene.children[0].name).toBe('door-upper');
});
