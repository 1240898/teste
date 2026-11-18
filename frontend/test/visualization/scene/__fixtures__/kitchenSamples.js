/* global jest, __dirname -- Jest fixture, loaded only by test files. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';

const samples = resolve(
  __dirname,
  '../../../../../docs/user_stories/web06/samples',
);

/** A WEB06 sample wrapped as the answer of GET /kitchen-configurations/active. */
export function activeSample(name, id = 'KCF-00001') {
  const content = JSON.parse(
    readFileSync(resolve(samples, `kitchen-${name}.json`), 'utf8'),
  );
  return { id, name, status: 'ACTIVE', version: 1, content, assets: {} };
}

/**
 * Fake LoadedAssets for every asset id referenced by a configuration: each
 * model is a small three scene, each texture a Texture. Spies on dispose show
 * that VIS02 never releases borrowed resources.
 */
export function fakeAssets(configuration, { missing = [] } = {}) {
  const models = new Map();
  const textures = new Map();
  const borrowed = [];
  const remember = (resource) => {
    borrowed.push(jest.spyOn(resource, 'dispose'));
    return resource;
  };
  const visit = (material) => {
    for (const [key, id] of Object.entries(material ?? {}))
      if (key.endsWith('MapAssetId') && !textures.has(id))
        textures.set(id, remember(new Texture()));
  };
  const { kitchen, elements } = configuration.content;
  visit(kitchen.floor?.material);
  visit(kitchen.walls?.material);
  for (const element of elements) {
    visit(element.material);
    const { assetId } = element.model;
    if (assetId && !models.has(assetId) && !missing.includes(assetId)) {
      const mesh = new Mesh(
        remember(new BoxGeometry()),
        remember(new MeshStandardMaterial()),
      );
      models.set(assetId, { scene: new Group().add(mesh), animations: [] });
    }
  }
  return {
    getModel: (id) => models.get(id),
    getTexture: (id) => textures.get(id),
    dispose: jest.fn(),
    borrowed,
  };
}