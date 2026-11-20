import { createCameraController } from '../camera/CameraController.js';
/**
 * VIS07 - plugs the CameraController into the VIS01 scene-module lifecycle
 * (D9): created in build() when the scene is ready, updated every frame,
 * disposed with the engine. Must be the LAST scene module.
 *
 * @returns {import('../sceneModule.js').SceneModule}
 */
export function createCameraControlsModule({
  createController = createCameraController,
} = {}) {
  let controller;
  let disposed = false;

  return {
    name: 'camera-controls',

    build(context) {
      if (context.signal?.aborted || disposed) return;
      controller = createController(
        context.camera,
        context.domElement,
        context.configuration.content,
      );
    },

    update() {
      if (!disposed) controller?.update();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      const current = controller;
      controller = undefined;
      current?.dispose();
    },
  };
}