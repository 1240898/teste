/**
 * @typedef {object} SceneModule
 * @property {string} name
 * @property {(context: SceneContext) => void | Promise<void>} build
 * @property {(deltaSeconds: number) => void} update
 * @property {() => void} dispose
 *
 * A factory returns a fresh module per attempt. Register resources as they are
 * acquired. Builds must check the signal around awaits, dispose any late
 * resources and settle on cancellation. Dispose must work after a partial
 * build. Use disposeResource for owned resources to share the engine's
 * deduplication. Loaded assets are borrowed and must not be disposed by modules.
 *
 * @typedef {object} SceneContext
 * @property {import('three').Scene} scene
 * @property {import('three').PerspectiveCamera} camera
 * @property {import('three').WebGLRenderer} renderer
 * @property {HTMLCanvasElement} domElement
 * @property {object} configuration The unmodified WEB06 response
 * @property {import('./SceneAssetLoader.js').LoadedAssets} assets
 * @property {AbortSignal} signal
 * @property {(resource: {dispose: () => void}) => void} disposeResource
 */

/** @param {SceneContext} context */
export function createSceneContext(context) {
  return Object.freeze(context);
}
