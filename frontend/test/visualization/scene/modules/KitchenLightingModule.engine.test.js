import { Box3, PMREMGenerator, Sphere, WebGLCubeRenderTarget } from 'three';
import { defaultSceneModules } from '../../../../src/visualization/scene/defaultSceneModules.js';
import { activeSample, fakeAssets } from '../__fixtures__/kitchenSamples.js';
import { createTestViewer } from '../__fixtures__/viewerEngine.js';

afterEach(() => jest.restoreAllMocks());

function load(engine, sample) {
  const configuration = activeSample(sample);
  return engine.load(
    configuration,
    fakeAssets(configuration),
    defaultSceneModules,
  );
}

test('IT01 - first paint uses the current layout, and reload creates fresh lighting', async () => {
  const filter = jest
    .spyOn(PMREMGenerator.prototype, 'fromScene')
    .mockImplementation(() => new WebGLCubeRenderTarget(16));
  const keys = [];
  const environments = [];
  for (const sample of ['compact', 'extended']) {
    const { engine, renderer } = createTestViewer();
    try {
      await expect(load(engine, sample)).resolves.toBe(true);
      const target = filter.mock.results.at(-1).value;
      environments.push(target);
      const dispose = jest.spyOn(target, 'dispose');
      renderer.render.mockImplementationOnce((scene) => {
        const key = scene.getObjectByName('lighting:key');
        keys.push(key);
        const bounds = new Box3().setFromObject(
          scene.getObjectByName('layout:root'),
        );
        const sphere = bounds.getBoundingSphere(new Sphere());
        expect(key.target.position.distanceTo(sphere.center)).toBeLessThan(
          1e-8,
        );
        expect(key.position.distanceTo(key.target.position)).toBeCloseTo(
          2.5 * sphere.radius,
        );
        expect(scene.getObjectByName('lighting:ambient').isAmbientLight).toBe(
          true,
        );
        expect(scene.environment).toBe(target.texture);
        expect(renderer.shadowMap.enabled && key.shadow.needsUpdate).toBe(true);
      });
      expect(engine.start()).toBe(true);
      expect(renderer.render).toHaveBeenCalledTimes(1);
      const [scene] = renderer.render.mock.calls[0];
      expect(scene.getObjectByName('lighting:key').castShadow).toBe(true);
      for (const name of ['layout:equipment', 'layout:assembly-line']) {
        const meshes = scene
          .getObjectByName(name)
          .getObjectsByProperty('isMesh', true);
        expect(meshes.length).toBeGreaterThan(0);
        for (const mesh of meshes) {
          expect(mesh.castShadow).toBe(true);
          expect(mesh.receiveShadow).toBe(true);
        }
      }
      expect(scene.getObjectByName('room:floor').receiveShadow).toBe(true);
      for (const side of ['NORTH', 'SOUTH', 'EAST', 'WEST']) {
        const wall = scene.getObjectByName(`room:wall:${side}`);
        expect(wall.receiveShadow).toBe(true);
        expect(wall.castShadow).toBe(false);
      }
      engine.dispose();
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(keys.at(-1).parent.parent).toBeNull();
    } finally {
      engine.dispose();
    }
  }
  expect(filter).toHaveBeenCalledTimes(2);
  expect(keys[0]).not.toBe(keys[1]);
  expect(keys[0].position.equals(keys[1].position)).toBe(false);
  expect(environments[0]).not.toBe(environments[1]);
});

test.each(['environment', 'first paint'])(
  'IT02 - cleans up a failed %s and retries with a fresh engine',
  async (failure) => {
    const filter = jest
      .spyOn(PMREMGenerator.prototype, 'fromScene')
      .mockImplementation(() => new WebGLCubeRenderTarget(16));
    const first = createTestViewer();
    const error = new Error(failure);
    if (failure === 'environment') {
      filter.mockImplementationOnce(() => {
        throw error;
      });
      await expect(load(first.engine, 'compact')).rejects.toMatchObject({
        phase: 'build',
        moduleName: 'kitchen-lighting',
        cause: error,
      });
      expect(first.renderer.render).not.toHaveBeenCalled();
    } else {
      await load(first.engine, 'compact');
      const dispose = jest.spyOn(filter.mock.results[0].value, 'dispose');
      const shadowMap = { dispose: jest.fn() };
      first.renderer.render.mockImplementationOnce((scene) => {
        scene.getObjectByName('lighting:key').shadow.map = shadowMap;
        throw error;
      });
      expect(first.engine.start()).toBe(false);
      expect(first.onFatalError).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'render', cause: error }),
      );
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(shadowMap.dispose).toHaveBeenCalledTimes(1);
    }
    expect(first.renderer.dispose).toHaveBeenCalledTimes(1);
    expect(first.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    const retry = createTestViewer();
    try {
      await expect(load(retry.engine, 'compact')).resolves.toBe(true);
      expect(retry.engine.start()).toBe(true);
      const [scene] = retry.renderer.render.mock.calls[0];
      expect(scene.environment).toBe(filter.mock.results[1].value.texture);
      expect(scene.getObjectByName('lighting:key').castShadow).toBe(true);
    } finally {
      retry.engine.dispose();
    }
  },
);
