import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from '../../shared/locale/localeContext.js';
import { RESET_VIEW_EVENT } from '../scene/camera/cameraSettings.js';
import { AssetLoadError, SceneAssetLoader } from '../scene/SceneAssetLoader.js';
import { ViewerEngine } from '../scene/ViewerEngine.js';
import { isWebGLAvailable } from '../scene/webglSupport.js';
import { loadActiveKitchen } from './kitchenViewerLoader.js';
import { withLightControls } from '../scene/defaultSceneModules.js';
import ManagerLightControls from './LightControlsPanel.jsx';
import ViewerStatusMessage from './ViewerStatusMessage.jsx';

const defaults = {
  supportsWebGL: isWebGLAvailable,
  loadConfiguration: loadActiveKitchen,
  preload: (assets, options) =>
    new SceneAssetLoader().preloadAll(assets, options),
  createEngine: (canvas, host, options) =>
    ViewerEngine.create(canvas, host, options),
};
const loading = { status: 'loading' };

export default function KitchenViewer({
  request,
  modules,
  dependencies = defaults,
  canEditLights = false,
  createLightControls,
}) {
  const { t } = useLocale();
  const title = useId();
  const viewport = useRef(null);
  const reloadButton = useRef(null);
  const currentRequest = useRef(request);
  const stopAttempt = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState(loading);

  // Token renewals and role refreshes update future requests without
  // starting another load while the user still has permission.
  useEffect(() => {
    currentRequest.current = request;
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const host = viewport.current;
    let canvas;
    let engine;
    let assets;
    const publish = (next) => {
      if (!signal.aborted) setState(next);
    };
    const failEngine = (error) => {
      if (signal.aborted) return;
      if (import.meta.env.DEV) console.error(error);
      canvas?.remove();
      publish({ status: 'failed' });
    };

    async function run() {
      if (!dependencies.supportsWebGL()) {
        publish({ status: 'unsupported' });
        return;
      }

      let configuration;
      try {
        const result = await dependencies.loadConfiguration(
          currentRequest.current,
          signal,
        );
        if (signal.aborted) return;
        if (result.status !== 'loading-assets') {
          publish(result);
          return;
        }
        configuration = result.configuration;
        publish({ status: 'loading-assets' });
        assets = await dependencies.preload(configuration.assets, {
          signal,
          timeoutMs: 30_000,
        });
        if (signal.aborted) {
          assets.dispose();
          assets = undefined;
          return;
        }
      } catch (error) {
        if (signal.aborted) return;
        publish(
          error instanceof AssetLoadError
            ? {
                status: 'error',
                reason: 'asset-unavailable',
                assetId: error.assetId,
              }
            : { status: 'error', reason: 'request' },
        );
        return;
      }

      try {
        // Each attempt (including StrictMode effect replay) attaches a fresh
        // canvas. A context that has been lost or released is never reused.
        canvas = host.ownerDocument.createElement('canvas');
        host.append(canvas);
        engine = dependencies.createEngine(canvas, host, {
          onFatalError: failEngine,
        });
        const controls = createLightControls?.();
        const factories = controls
          ? withLightControls(modules, controls)
          : modules;
        const ownedAssets = assets;
        assets = undefined;
        const built = await engine.load(
          configuration,
          ownedAssets,
          factories,
          signal,
        );
        if (signal.aborted || !built || !engine.start()) return;
        publish({ status: 'ready', configuration, controls });
      } catch (error) {
        engine?.dispose();
        assets?.dispose();
        assets = undefined;
        failEngine(error);
      }
    }

    const cleanup = () => {
      if (signal.aborted) return;
      controller.abort();
      engine?.dispose();
      assets?.dispose();
      assets = undefined;
      canvas?.remove();
    };
    stopAttempt.current = cleanup;
    // In development StrictMode discards the first effect before this runs.
    void Promise.resolve().then(() => {
      if (!signal.aborted) return run();
    });
    return cleanup;
  }, [attempt, modules, dependencies, createLightControls]);

  function restart() {
    stopAttempt.current?.();
    setState(loading);
    setAttempt((current) => current + 1);
  }

  // VIS07 (BR 11, D10): the CameraController listens for this event on the
  // canvas; the viewer keeps no reference to the camera or the scene modules.
  function resetView() {
    viewport.current
      ?.querySelector('canvas')
      ?.dispatchEvent(new Event(RESET_VIEW_EVENT));
  }

  const ready = state.status === 'ready';
  const silent = ['expired', 'cancelled'].includes(state.status);
  return (
    <section aria-labelledby={silent ? undefined : title} hidden={silent}>
      <h1 id={title}>{t('viewer')}</h1>
      <ViewerStatusMessage state={state} onRetry={restart} />
      {ready && (
        <div className="kitchen-viewer__toolbar">
          <p>
            <strong>{state.configuration.name}</strong>{' '}
            {t('viewerVersion', state.configuration)}
          </p>
          <div className="kitchen-viewer__actions">
            <button
              className="button button--secondary"
              type="button"
              onClick={resetView}
            >
              {t('viewerResetView')}
            </button>
            <button
              className="button button--secondary"
              type="button"
              ref={reloadButton}
              onClick={restart}
            >
              {t('viewerReload')}
            </button>
          </div>
        </div>
      )}
      <div
        ref={viewport}
        className="kitchen-viewer__viewport"
        data-visible={ready}
        aria-hidden={!ready}
        role="img"
        aria-label={t('viewerCanvas')}
      />
      {ready && canEditLights && state.controls && (
        <ManagerLightControls
          key={attempt}
          controls={state.controls}
          reloadButton={reloadButton}
        />
      )}
    </section>
  );
}
