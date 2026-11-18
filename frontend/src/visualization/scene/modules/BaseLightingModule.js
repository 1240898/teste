import { AmbientLight } from 'three';

/** @returns {import('../sceneModule.js').SceneModule} */
export function createBaseLightingModule() {
  let light;
  return {
    name: 'base-lighting',
    build({ scene }) {
      light = new AmbientLight(0xffffff, 2);
      scene.add(light);
    },
    update() {},
    dispose() {
      light?.removeFromParent();
      light = undefined;
    },
  };
}
