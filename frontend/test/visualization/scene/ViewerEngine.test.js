import { BufferGeometry, Mesh, MeshBasicMaterial } from 'three';
import { ViewerEngine } from '../../../src/visualization/scene/ViewerEngine.js';
const configuration = {
  content: { kitchen: { dimensions: { width: 12, depth: 8 } } },
};

function setup(options = {}) {
  const order = [];
  const canvas = new EventTarget();
  const container = { clientWidth: 800, clientHeight: 400 };
  const renderer = {
    setPixelRatio: jest.fn(),
    setSize: jest.fn(),
    render: jest.fn(),
    setAnimationLoop: jest.fn((frame) => {
      if (!frame) order.push('stop');
    }),
    dispose: jest.fn(() => order.push('renderer')),
    forceContextLoss: jest.fn(() => order.push('context')),
  };
  const observer = { observe: jest.fn(), disconnect: jest.fn() };
  const onFatalError = jest.fn(() => order.push('fatal'));
  const onCleanupError = jest.fn();
  const assets = { dispose: jest.fn(() => order.push('assets')) };
  const factory = (name) => () => ({
    name,
    build: jest.fn(() => order.push(`build ${name}`)),
    update: jest.fn(() => order.push(`update ${name}`)),
    dispose: jest.fn(() => order.push(`dispose ${name}`)),
  });
  const engine = ViewerEngine.create(canvas, container, {
    rendererFactory: () => renderer,
    resizeObserverFactory: () => observer,
    onFatalError,
    onCleanupError,
    pixelRatio: 9,
    ...options,
  });
  const load = (modules, signal) =>
    engine.load(configuration, assets, modules, signal);
  const frame = () =>
    renderer.setAnimationLoop.mock.calls.find(([callback]) => callback)?.[0];
  return {
    engine,
    renderer,
    observer,
    canvas,
    container,
    assets,
    onFatalError,
    onCleanupError,
    order,
    factory,
    load,
    frame,
  };
}

test('builds in order, frames the floor, resizes and updates each module per frame', async () => {
  const h = setup();
  const a = h.factory('A')();
  const b = h.factory('B')();
  try {
    await expect(h.load([() => a, () => b])).resolves.toBe(true);
    expect(a.build).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration,
        assets: h.assets,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(h.renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(h.observer.observe).toHaveBeenCalledWith(h.container);
    expect(h.renderer.setSize).toHaveBeenCalledWith(800, 400, false);
    expect(h.engine.start()).toBe(true);
    const [, camera] = h.renderer.render.mock.calls[0];
    expect(camera.aspect).toBe(2);
    h.engine.resize(400, 800);
    expect(camera.aspect).toBe(0.5);
    expect(h.renderer.setSize).toHaveBeenLastCalledWith(400, 800, false);
    h.frame()(100);
    h.frame()(116);
    expect(a.update).toHaveBeenLastCalledWith(0.016);
    expect(b.update).toHaveBeenLastCalledWith(0.016);
    expect(h.renderer.render).toHaveBeenCalledTimes(3);
    expect(h.order.slice(0, 4)).toEqual([
      'build A',
      'build B',
      'update A',
      'update B',
    ]);
  } finally {
    h.engine.dispose();
  }
});

test('releases once in reverse order and continues when a module or renderer throws', async () => {
  const h = setup();
  const b = h.factory('B')();
  b.dispose.mockImplementation(() => {
    throw new Error('module cleanup');
  });
  h.renderer.dispose.mockImplementation(() => {
    throw new Error('renderer cleanup');
  });
  await h.load([h.factory('A'), () => b, h.factory('C')]);
  h.engine.start();
  h.engine.dispose();
  h.engine.dispose();
  expect(h.order.slice(3)).toEqual([
    'stop',
    'dispose C',
    'dispose A',
    'assets',
    'context',
  ]);
  expect(b.dispose).toHaveBeenCalledTimes(1);
  expect(h.observer.disconnect).toHaveBeenCalledTimes(1);
  expect(h.renderer.forceContextLoss).toHaveBeenCalledTimes(1);
  expect(h.onCleanupError).toHaveBeenCalledTimes(1);
  expect(h.onCleanupError.mock.calls[0][0].errors).toHaveLength(2);
});

test('cleans up partially created a renderer if initialization fails', () => {
  const canvas = new EventTarget();
  const renderer = {
    setPixelRatio: jest.fn(() => {
      throw new Error('cannot set pixel ratio');
    }),
    setAnimationLoop: jest.fn(),
    dispose: jest.fn(),
    forceContextLoss: jest.fn(),
  };
  const resizeObserverFactory = jest.fn();
  expect(() =>
    ViewerEngine.create(
      canvas,
      {},
      { rendererFactory: () => renderer, resizeObserverFactory },
    ),
  ).toThrow(expect.objectContaining({ phase: 'renderer' }));
  expect(resizeObserverFactory).not.toHaveBeenCalled();
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
  expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
});

test.each([
  () => {
    throw new Error('sync build');
  },
  () => Promise.reject(new Error('async build')),
])('releases partially built modules on build failure %#', async (fail) => {
  const h = setup();
  const b = h.factory('B')();
  b.build.mockImplementation(fail);
  const cFactory = jest.fn(h.factory('C'));
  await expect(
    h.load([h.factory('A'), () => b, cFactory]),
  ).rejects.toMatchObject({ phase: 'build', moduleName: 'B' });
  expect(cFactory).not.toHaveBeenCalled();
  expect(h.order).toEqual([
    'build A',
    'stop',
    'dispose B',
    'dispose A',
    'assets',
    'renderer',
    'context',
  ]);
  expect(h.engine.start()).toBe(false);
  expect(h.onFatalError).not.toHaveBeenCalled();
});

test.each(['update', 'render', 'context'])(
  'stops before notifying a %s failure and ignores queued frames',
  async (phase) => {
    const h = setup();
    const module = h.factory('A')();
    await h.load([() => module]);
    h.engine.start();
    const frame = h.frame();
    const error = new Error('frame failure');
    if (phase === 'update')
      module.update.mockImplementation(() => {
        throw error;
      });
    if (phase === 'render')
      h.renderer.render.mockImplementation(() => {
        throw error;
      });
    if (phase === 'context')
      h.canvas.dispatchEvent(
        new Event('webglcontextlost', { cancelable: true }),
      );
    else frame(0);
    frame(16);
    expect(h.onFatalError).toHaveBeenCalledTimes(1);
    expect(h.onFatalError).toHaveBeenCalledWith(
      expect.objectContaining({ phase }),
    );
    expect(h.order.slice(-6)).toEqual([
      'stop',
      'dispose A',
      'assets',
      'renderer',
      'context',
      'fatal',
    ]);
  },
);

test('aborts a pending build immediately and sweeps late scene resources', async () => {
  const h = setup();
  const early = new BufferGeometry();
  const late = new BufferGeometry();
  const earlyDispose = jest.spyOn(early, 'dispose');
  const lateDispose = jest.spyOn(late, 'dispose');
  const b = h.factory('B')();
  let finishBuild;
  let context;
  const started = new Promise((startedBuild) => {
    b.build.mockImplementation((ctx) => {
      context = ctx;
      context.scene.add(new Mesh(early, new MeshBasicMaterial()));
      return new Promise((resolve) => {
        finishBuild = () => {
          context.scene.add(new Mesh(late, new MeshBasicMaterial()));
          resolve();
        };
        startedBuild();
      });
    });
  });
  const c = jest.fn(h.factory('C'));
  const building = h.load([h.factory('A'), () => b, c]);
  await started;
  h.engine.dispose();
  expect(context.signal.aborted).toBe(true);
  expect(b.dispose).toHaveBeenCalledTimes(1);
  expect(earlyDispose).toHaveBeenCalledTimes(1);
  finishBuild();
  await expect(building).resolves.toBe(false);
  expect(lateDispose).toHaveBeenCalledTimes(1);
  expect(earlyDispose).toHaveBeenCalledTimes(1);
  expect(c).not.toHaveBeenCalled();
  expect(h.assets.dispose).toHaveBeenCalledTimes(1);
  expect(h.onFatalError).not.toHaveBeenCalled();
});

test('adopts and releases the assets even with an already-aborted attempt', async () => {
  const h = setup();
  const factory = jest.fn(h.factory('A'));
  await expect(h.load([factory], AbortSignal.abort())).resolves.toBe(false);
  expect(factory).not.toHaveBeenCalled();
  expect(h.assets.dispose).toHaveBeenCalledTimes(1);
  expect(h.renderer.dispose).toHaveBeenCalledTimes(1);
  expect(h.onFatalError).not.toHaveBeenCalled();
});
