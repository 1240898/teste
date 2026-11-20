import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import {
  createResourceDisposer,
  disposeSceneResources,
} from './disposeResources.js';
import { createSceneContext } from './sceneModule.js';
import { ViewerEngineError } from './ViewerEngineError.js';

const makeRenderer = (canvas) =>
  new WebGLRenderer({ canvas, antialias: true, alpha: true });
const observeResize = (callback) => new ResizeObserver(callback);
const reportCleanupErrors = (error) => {
  if (import.meta.env.DEV) console.error(error);
};

/** Owns one renderer, scene, build and frame loop. No React dependencies. */
export class ViewerEngine {
  #canvas;
  #container;
  #renderer;
  #observer;
  #scene;
  #camera;
  #assets;
  #modules = [];
  #buildController = new AbortController();
  #disposed = false;
  #running = false;
  #loaded = false;
  #lastFrame;
  #errors = [];
  #release = createResourceDisposer((cleanup) => this.#tryCleanup(cleanup));
  #onFatalError;
  #onCleanupError;

  constructor(canvas, container, onFatalError, onCleanupError) {
    this.#canvas = canvas;
    this.#container = container;
    this.#onFatalError = onFatalError;
    this.#onCleanupError = onCleanupError;
  }

  static create(
    canvas,
    container,
    {
      rendererFactory = makeRenderer,
      resizeObserverFactory = observeResize,
      pixelRatio = globalThis.devicePixelRatio ?? 1,
      onFatalError = () => {},
      onCleanupError = reportCleanupErrors,
    } = {},
  ) {
    const engine = new ViewerEngine(
      canvas,
      container,
      onFatalError,
      onCleanupError,
    );
    try {
      engine.#renderer = rendererFactory(canvas);
      engine.#scene = new Scene();
      engine.#camera = new PerspectiveCamera(50, 1, 0.1, 200);
      engine.#camera.up.set(0, 1, 0);
      engine.#renderer.setPixelRatio(Math.min(pixelRatio, 2));
      engine.#resizeToContainer();
      engine.#observer = resizeObserverFactory(engine.#onResize);
      engine.#observer.observe(container);
      canvas.addEventListener('webglcontextlost', engine.#onContextLost);
      return engine;
    } catch (cause) {
      engine.dispose();
      throw new ViewerEngineError('renderer', { cause });
    }
  }

  #resizeToContainer() {
    this.resize(this.#container.clientWidth, this.#container.clientHeight);
  }

  #onResize = ([entry] = []) => {
    if (this.#disposed) return;
    try {
      if (entry) this.resize(entry.contentRect.width, entry.contentRect.height);
      else this.#resizeToContainer();
    } catch (cause) {
      this.#fatal(new ViewerEngineError('render', { cause }));
    }
  };

  #onContextLost = (event) => {
    event.preventDefault();
    this.#fatal(new ViewerEngineError('context'));
  };

  resize(width, height) {
    if (this.#disposed || width < 1 || height < 1) return;
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(width, height, false);
  }

  #positionCamera(configuration) {
    const { width, depth } = configuration.content.kitchen.dimensions;
    const diagonal = Math.hypot(width, depth);
    const halfFov = (this.#camera.fov * Math.PI) / 360;
    const horizontalHalfFov = Math.atan(
      Math.tan(halfFov) * this.#camera.aspect,
    );
    const distance =
      diagonal / (2 * Math.sin(Math.min(halfFov, horizontalHalfFov)));
    const direction = this.#camera.position.set(1, 0.95, 1);
    direction.setLength(distance * 1.08);
    this.#camera.far = Math.max(200, direction.length() + diagonal);
    this.#camera.lookAt(0, 0, 0);
    this.#camera.updateProjectionMatrix();
  }

  /** Takes ownership of assets immediately, even if the attempt was aborted. */
  async load(configuration, assets, factories, signal) {
    if (this.#disposed) {
      this.#tryCleanup(() => assets.dispose(this.#release));
      return false;
    }
    this.#assets = assets;
    const buildSignal = this.#buildController.signal;
    const cancel = () => this.dispose();
    let building;
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      if (signal?.aborted) this.dispose();
      if (buildSignal.aborted) return false;
      this.#positionCamera(configuration);
      const context = createSceneContext({
        scene: this.#scene,
        camera: this.#camera,
        renderer: this.#renderer,
        domElement: this.#canvas,
        configuration,
        assets,
        signal: buildSignal,
        disposeResource: this.#release,
      });
      for (const makeModule of factories) {
        const module = makeModule();
        building = module.name;
        this.#modules.push(module);
        await module.build(context);
        if (buildSignal.aborted) return false;
        building = undefined;
      }
      this.#loaded = true;
      return true;
    } catch (cause) {
      if (buildSignal.aborted) return false;
      this.dispose();
      throw new ViewerEngineError('build', { cause, moduleName: building });
    } finally {
      signal?.removeEventListener('abort', cancel);
      if (buildSignal.aborted) this.#sweepScene();
    }
  }

  start() {
    if (this.#disposed || !this.#loaded || this.#running) return false;
    // Render once before the canvas becomes visible. A failing first paint
    // follows the same failure path as an error in an animation frame.
    try {
      this.#renderer.render(this.#scene, this.#camera);
      if (this.#disposed) return false;
      this.#running = true;
      this.#renderer.setAnimationLoop(this.#frame);
      return this.#running;
    } catch (cause) {
      this.#fatal(new ViewerEngineError('render', { cause }));
      return false;
    }
  }

  #frame = (timeMs) => {
    if (!this.#running || this.#disposed) return;
    const delta =
      this.#lastFrame === undefined ? 0 : (timeMs - this.#lastFrame) / 1000;
    this.#lastFrame = timeMs;
    let updating;
    try {
      for (const module of this.#modules) {
        updating = module.name;
        module.update(delta);
        if (this.#disposed) return;
      }
      updating = undefined;
      this.#renderer.render(this.#scene, this.#camera);
    } catch (cause) {
      this.#fatal(
        new ViewerEngineError(updating ? 'update' : 'render', {
          cause,
          moduleName: updating,
        }),
      );
    }
  };

  #fatal(error) {
    if (this.#disposed) return;
    this.dispose();
    this.#onFatalError(error);
  }

  #tryCleanup(cleanup) {
    try {
      cleanup();
    } catch (error) {
      this.#errors.push(error);
    }
  }

  #sweepScene() {
    if (!this.#scene) return;
    this.#tryCleanup(() => disposeSceneResources(this.#scene, this.#release));
    this.#tryCleanup(() => this.#scene.clear());
    this.#flushCleanupErrors();
  }

  #flushCleanupErrors() {
    if (!this.#errors.length) return;
    const errors = this.#errors.splice(0);
    this.#onCleanupError(
      new AggregateError(errors, 'Kitchen viewer cleanup failed'),
    );
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#running = false;
    this.#tryCleanup(() => this.#renderer?.setAnimationLoop(null));
    this.#tryCleanup(() => this.#buildController.abort());
    this.#tryCleanup(() => this.#observer?.disconnect());
    this.#tryCleanup(() =>
      this.#canvas.removeEventListener('webglcontextlost', this.#onContextLost),
    );
    // A partial module may remove its meshes before its dispose() throws.
    const previousRoots = this.#scene?.children.slice() ?? [];
    for (const module of this.#modules.reverse())
      this.#tryCleanup(() => module.dispose());
    this.#modules = [];
    for (const root of previousRoots)
      this.#tryCleanup(() => disposeSceneResources(root, this.#release));
    if (this.#scene) {
      this.#tryCleanup(() => disposeSceneResources(this.#scene, this.#release));
      this.#tryCleanup(() => this.#scene.clear());
    }
    this.#tryCleanup(() => this.#assets?.dispose(this.#release));
    this.#assets = undefined;
    this.#tryCleanup(() => this.#renderer?.dispose());
    this.#tryCleanup(() => this.#renderer?.forceContextLoss());
    this.#flushCleanupErrors();
  }
}
