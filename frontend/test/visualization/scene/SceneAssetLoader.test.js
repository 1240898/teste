import { BufferGeometry, Group, Mesh, MeshBasicMaterial, Texture } from 'three';
import {
  LoadedAssets,
  SceneAssetLoader,
} from '../../../src/visualization/scene/SceneAssetLoader.js';
const assets = {
  model: {
    kind: 'MODEL',
    format: 'glb',
    url: 'https://example.test/model.glb',
  },
  texture: {
    kind: 'TEXTURE',
    format: 'png',
    url: 'https://example.test/map.png',
  },
};

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function makeModel() {
  const geo = new BufferGeometry();
  const map = new Texture();
  const mat = new MeshBasicMaterial({ map });
  const scene = new Group();
  scene.add(new Mesh(geo, mat), new Mesh(geo, mat), new Mesh(geo, mat));
  return { resource: { scene, scenes: [scene] }, geo, map, mat };
}

afterEach(() => jest.useRealTimers());

test('preloads in parallel and gives typed access to the complete set', async () => {
  const first = deferred();
  const second = deferred();
  const loadAsset = jest
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const pending = new SceneAssetLoader(loadAsset).preloadAll(assets);
  expect(loadAsset).toHaveBeenCalledTimes(2);
  const { resource } = makeModel();
  const texture = new Texture();
  second.resolve(texture);
  first.resolve(resource);
  const loaded = await pending;
  expect(loaded.getModel('model')).toBe(resource);
  expect(loaded.getTexture('texture')).toBe(texture);
  expect(loaded.getModel('texture')).toBeUndefined();
  loaded.dispose();
});

test('disposes loaded assets, aborts other downloads, and identifies the failed file', async () => {
  const bad = deferred();
  const late = deferred();
  const texture = new Texture();
  const delayed = new Texture();
  const textureDispose = jest.spyOn(texture, 'dispose');
  const delayedDispose = jest.spyOn(delayed, 'dispose');
  const loadAsset = jest
    .fn()
    .mockResolvedValueOnce(texture)
    .mockReturnValueOnce(bad.promise)
    .mockReturnValueOnce(late.promise);
  const pending = new SceneAssetLoader(loadAsset).preloadAll({
    texture: assets.texture,
    missing: assets.texture,
    delayed: assets.texture,
  });
  const result = expect(pending).rejects.toMatchObject({
    assetId: 'missing',
    cause: 'not-found',
  });
  bad.reject(new Error('not-found'));
  await result;
  expect(loadAsset.mock.calls[2][1].aborted).toBe(true);
  expect(textureDispose).toHaveBeenCalledTimes(1);
  late.resolve(delayed);
  await late.promise;
  expect(delayedDispose).toHaveBeenCalledTimes(1);
});

test('uses one deadline and resolves the failure even if decoding never settles', async () => {
  jest.useFakeTimers();
  const loadAsset = jest.fn(() => new Promise(() => {}));
  const result = expect(
    new SceneAssetLoader(loadAsset).preloadAll(assets),
  ).rejects.toMatchObject({ assetId: 'model', cause: 'timeout' });
  jest.advanceTimersByTime(30_000);
  await result;
  expect(loadAsset.mock.calls.every(([, signal]) => signal.aborted)).toBe(true);
});

test('caller cancellation stays an abort and releases the assets already loaded', async () => {
  const controller = new AbortController();
  const texture = new Texture();
  const dispose = jest.spyOn(texture, 'dispose');
  const loadAsset = jest
    .fn()
    .mockResolvedValueOnce(texture)
    .mockReturnValueOnce(new Promise(() => {}));
  const pending = new SceneAssetLoader(loadAsset).preloadAll(assets, {
    signal: controller.signal,
  });
  const result = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await Promise.resolve();
  controller.abort();
  await result;
  expect(dispose).toHaveBeenCalledTimes(1);
});

test('disposes shared model resources exactly once even when also owned as an asset', () => {
  const { resource, geo, mat, map } = makeModel();
  const spies = [geo, mat, map].map((item) => jest.spyOn(item, 'dispose'));
  const loaded = new LoadedAssets([
    ['model', { kind: 'MODEL', resource }],
    ['texture', { kind: 'TEXTURE', resource: map }],
  ]);
  loaded.dispose();
  loaded.dispose();
  for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
});
