/** @jest-environment jsdom */
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LocaleContext } from '../../../src/shared/locale/localeContext.js';
import { translate } from '../../../src/shared/locale/messages.js';
import { AssetLoadError } from '../../../src/visualization/scene/SceneAssetLoader.js';
import KitchenViewer from '../../../src/visualization/viewer/KitchenViewer.jsx';

const modules = [];
const configuration = {
  id: 'KCF-00001',
  version: 1,
  name: 'Compact',
  assets: {},
};
const loaded = (data = configuration) => ({
  status: 'loading-assets',
  configuration: data,
});
const request = () => {};

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let host, root, dependencies, engine, assets;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  assets = { dispose: jest.fn() };
  engine = {
    load: jest.fn().mockResolvedValue(true),
    start: jest.fn().mockReturnValue(true),
    dispose: jest.fn(),
  };
  dependencies = {
    supportsWebGL: jest.fn().mockReturnValue(true),
    loadConfiguration: jest.fn().mockResolvedValue(loaded()),
    preload: jest.fn().mockResolvedValue(assets),
    createEngine: jest.fn().mockReturnValue(engine),
  };
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

function mount(locale = 'en-GB', override = {}) {
  return act(async () => {
    root.render(
      <StrictMode>
        <LocaleContext.Provider
          value={{ locale, t: (key, values) => translate(locale, key, values) }}
        >
          <KitchenViewer
            request={request}
            modules={modules}
            dependencies={dependencies}
            {...override}
          />
        </LocaleContext.Provider>
      </StrictMode>,
    );
  });
}

const viewport = () => host.querySelector('.kitchen-viewer__viewport');
const button = (text) =>
  [...host.querySelectorAll('button')].find(
    (item) => item.textContent === text,
  );
const click = (text) => act(async () => button(text).click());

test('does not request the configuration when WebGL is unavailable', async () => {
  dependencies.supportsWebGL.mockReturnValue(false);
  await mount();
  expect(host.textContent).toContain('Your browser cannot display 3D content');
  expect(dependencies.loadConfiguration).not.toHaveBeenCalled();
  expect(host.querySelector('canvas')).toBeNull();
});

test('waits for all assets before creating the engine and keeps the same scene on translation', async () => {
  const download = deferred();
  dependencies.preload.mockReturnValueOnce(download.promise);
  await mount();
  expect(host.querySelector('[role="status"]').textContent).toContain(
    'Loading 3D models',
  );
  expect(dependencies.createEngine).not.toHaveBeenCalled();
  expect(host.querySelector('canvas')).toBeNull();
  await act(async () => download.resolve(assets));
  const canvas = host.querySelector('canvas');
  expect(canvas).not.toBeNull();
  expect(viewport().dataset.visible).toBe('true');
  expect(host.textContent).toContain('KCF-00001, version 1');
  expect(dependencies.loadConfiguration).toHaveBeenCalledTimes(1);
  await mount('pt-PT');
  expect(button('Recarregar')).toBeDefined();
  expect(host.querySelector('canvas')).toBe(canvas);
  expect(viewport().getAttribute('aria-label')).toBe(
    'Representação 3D da cozinha ativa',
  );
  expect(dependencies.loadConfiguration).toHaveBeenCalledTimes(1);
});

test.each([
  ['empty', 'No kitchen configuration is active.', false],
  ['invalid', 'The active kitchen configuration cannot be displayed.', false],
  ['denied', 'You do not have permission', false],
  ['error', 'The kitchen viewer is unavailable.', true],
])('shows %s without creating a scene', async (status, message, retry) => {
  dependencies.loadConfiguration.mockResolvedValue({ status });
  await mount();
  expect(host.textContent).toContain(message);
  expect(Boolean(button('Try again'))).toBe(retry);
  expect(dependencies.preload).not.toHaveBeenCalled();
  expect(host.querySelector('canvas')).toBeNull();
});

test.each(['expired', 'cancelled'])(
  'leaves the shell in charge of %s',
  async (status) => {
    dependencies.loadConfiguration.mockResolvedValue({ status });
    await mount();
    expect(host.querySelector('section').hidden).toBe(true);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(dependencies.createEngine).not.toHaveBeenCalled();
  },
);

test('names the missing asset and retries without allocating a partial scene', async () => {
  dependencies.preload.mockRejectedValueOnce(
    new AssetLoadError('AST-MDL-OVEN-DOME-01', 'not-found'),
  );
  await mount();
  expect(host.querySelector('[role="alert"]').textContent).toContain(
    'AST-MDL-OVEN-DOME-01',
  );
  expect(dependencies.createEngine).not.toHaveBeenCalled();
  await click('Try again');
  expect(dependencies.loadConfiguration).toHaveBeenCalledTimes(2);
  expect(viewport().dataset.visible).toBe('true');
});

test('a renderer creation failure releases untransferred assets and offers Retry', async () => {
  dependencies.createEngine.mockImplementationOnce(() => {
    throw new Error('GPU error');
  });
  await mount();
  expect(host.querySelector('[role="alert"]').textContent).toContain(
    'stopped because of an error',
  );
  expect(host.querySelector('canvas')).toBeNull();
  expect(assets.dispose).toHaveBeenCalledTimes(1);
  expect(button('Try again')).toBeDefined();
});

test('Reload and context-loss Retry replace the canvas and release the previous engine first', async () => {
  const next = { ...engine, dispose: jest.fn() };
  dependencies.createEngine
    .mockReturnValueOnce(engine)
    .mockImplementationOnce(() => {
      expect(engine.dispose).toHaveBeenCalledTimes(1);
      return next;
    });
  dependencies.loadConfiguration
    .mockResolvedValueOnce(loaded())
    .mockResolvedValue(
      loaded({
        ...configuration,
        name: 'Extended',
        id: 'KCF-00002',
        version: 3,
      }),
    );
  await mount();
  const firstCanvas = host.querySelector('canvas');
  await click('Reload');
  const secondCanvas = host.querySelector('canvas');
  expect(firstCanvas.isConnected).toBe(false);
  expect(secondCanvas).not.toBe(firstCanvas);
  expect(host.textContent).toContain('Extended');
  await act(async () => {
    dependencies.createEngine.mock.calls[1][2].onFatalError(
      new Error('context lost'),
    );
  });
  expect(secondCanvas.isConnected).toBe(false);
  await click('Try again');
  const thirdCanvas = host.querySelector('canvas');
  expect(thirdCanvas).not.toBe(secondCanvas);
  expect(next.dispose).toHaveBeenCalledTimes(1);
});

test('leaving the page aborts a pending build and never starts the engine with its late result', async () => {
  const building = deferred();
  engine.load.mockReturnValue(building.promise);
  await mount();
  const canvas = host.querySelector('canvas');
  const signal = engine.load.mock.calls[0][3];
  await act(async () => root.render(null));
  expect(signal.aborted).toBe(true);
  expect(canvas.isConnected).toBe(false);
  expect(engine.dispose).toHaveBeenCalledTimes(1);
  await act(async () => building.resolve(true));
  expect(engine.start).not.toHaveBeenCalled();
});

test('leaving the page releases a late asset set without creating a renderer', async () => {
  const preload = deferred();
  dependencies.preload.mockReturnValue(preload.promise);
  await mount();
  await act(async () => root.render(null));
  expect(dependencies.preload.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => preload.resolve(assets));
  expect(assets.dispose).toHaveBeenCalledTimes(1);
  expect(dependencies.createEngine).not.toHaveBeenCalled();
});
