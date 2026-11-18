import { LoadingManager, TextureLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createResourceDisposer, disposeAsset } from './disposeResources.js';

export class AssetLoadError extends Error {
  constructor(assetId, cause) {
    super(`Could not load kitchen asset ${assetId}`, { cause });
    this.name = 'AssetLoadError';
    this.assetId = assetId;
  }
}

// These URLs are read-only binary assets from WEB06, not REST operations.
// The fetch is scoped to this attempt and carries no application credentials.
async function downloadAsset(asset, signal) {
  const response = await globalThis.fetch(asset.url, {
    signal,
    credentials: 'omit',
  });
  if (!response.ok) {
    throw new Error(
      response.status === 404 ? 'not-found' : `HTTP ${response.status}`,
    );
  }
  if (asset.kind === 'MODEL') {
    const bytes = await response.arrayBuffer();
    signal.throwIfAborted();
    const manager = new LoadingManager();
    // This also cancels downloads of external glTF resources when supported.
    const cancel = () => manager.abort();
    let dependencyFailed = false;
    manager.onError = () => {
      dependencyFailed = true;
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const baseUrl = new URL('.', response.url || asset.url).href;
      const model = await new GLTFLoader(manager).parseAsync(bytes, baseUrl);
      // GLTFLoader can resolve a scene even when a referenced image failed.
      if (dependencyFailed) {
        disposeAsset(model, createResourceDisposer(disposeQuietly));
        throw new Error(
          'A resource used by the glTF model could not be loaded',
        );
      }
      return model;
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  }

  const blob = await response.blob();
  signal.throwIfAborted();
  const url = URL.createObjectURL(blob);
  const revoke = () => URL.revokeObjectURL(url);
  signal.addEventListener('abort', revoke, { once: true });
  try {
    return await new TextureLoader().loadAsync(url);
  } finally {
    signal.removeEventListener('abort', revoke);
    revoke();
  }
}

function disposeQuietly(cleanup) {
  try {
    cleanup();
  } catch (error) {
    if (import.meta.env.DEV) console.error(error);
  }
}

export class LoadedAssets {
  #entries;
  #disposed = false;

  constructor(entries) {
    this.#entries = new Map(entries);
  }

  /** The GLTF result (scene, scenes and animations) is borrowed by modules. */
  getModel(id) {
    const entry = this.#entries.get(id);
    return entry?.kind === 'MODEL' ? entry.resource : undefined;
  }

  getTexture(id) {
    const entry = this.#entries.get(id);
    return entry?.kind === 'TEXTURE' ? entry.resource : undefined;
  }

  dispose(release = createResourceDisposer(disposeQuietly)) {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const { resource } of this.#entries.values()) {
      disposeQuietly(() => disposeAsset(resource, release));
    }
    this.#entries.clear();
  }
}

export class SceneAssetLoader {
  constructor(loadAsset = downloadAsset) {
    this.loadAsset = loadAsset;
  }

  /** One attempt deadline; decoding may finish late and is then cleaned up. */
  async preloadAll(assets, { signal, timeoutMs = 30_000 } = {}) {
    signal?.throwIfAborted();
    const entries = Object.entries(assets);
    if (entries.length === 0) return new LoadedAssets();

    const controller = new AbortController();
    const loaded = new Map();
    const pending = new Set(entries.map(([id]) => id));
    const dispose = createResourceDisposer(disposeQuietly);
    let rejectInterrupted;
    const interrupted = new Promise((_, reject) => {
      rejectInterrupted = reject;
    });
    const abort = () => controller.abort(signal.reason);
    const onInterrupted = () => rejectInterrupted(controller.signal.reason);
    signal?.addEventListener('abort', abort, { once: true });
    controller.signal.addEventListener('abort', onInterrupted, { once: true });
    const timer = setTimeout(() => {
      const [id] = pending;
      if (id !== undefined) controller.abort(new AssetLoadError(id, 'timeout'));
    }, timeoutMs);

    const downloads = entries.map(async ([id, asset]) => {
      try {
        const resource = await this.loadAsset(asset, controller.signal);
        if (controller.signal.aborted) {
          disposeQuietly(() => disposeAsset(resource, dispose));
          return;
        }
        loaded.set(id, { kind: asset.kind, resource });
        pending.delete(id);
      } catch (cause) {
        if (!controller.signal.aborted) {
          const reason = cause?.message === 'not-found' ? 'not-found' : cause;
          controller.abort(new AssetLoadError(id, reason));
        }
      }
    });

    try {
      await Promise.race([interrupted, Promise.all(downloads)]);
      controller.signal.throwIfAborted();
      return new LoadedAssets(loaded);
    } catch (error) {
      new LoadedAssets(loaded).dispose(dispose);
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', onInterrupted);
    }
  }
}
