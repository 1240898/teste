import {
  AmbientLight,
  Box3,
  Group,
  PCFShadowMap,
  PMREMGenerator,
  Sphere,
  SpotLight,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AMBIENT_LIGHT,
  KEY_SPOTLIGHT,
  LIGHTING_ROOT,
  LAYOUT_ASSEMBLY_LINE,
  LAYOUT_ROOT,
} from '../sceneObjectNames.js';

/** The caller owns the filtered target. Temporary room resources end here. */
export function buildEnvironmentMap(renderer, release) {
  const room = new RoomEnvironment();
  let generator;
  try {
    generator = new PMREMGenerator(renderer);
    return generator.fromScene(room, 0, 0.1, 100, { size: 256 });
  } finally {
    try {
      if (generator) release(generator);
    } finally {
      release(room);
    }
  }
}

function getLayoutSphere(scene) {
  const layout = scene.getObjectByName(LAYOUT_ROOT);
  if (!layout) throw new Error('Kitchen lighting requires a layout root');

  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(layout);
  const assemblyLine = layout.parent.children.find(
    ({ name }) => name === LAYOUT_ASSEMBLY_LINE,
  );
  if (assemblyLine) bounds.expandByObject(assemblyLine);

  const size = bounds.getSize(new Vector3());
  const sphere = bounds.getBoundingSphere(new Sphere());
  if (
    ![...sphere.center.toArray(), sphere.radius].every(Number.isFinite) ||
    size.x <= 0 ||
    size.y <= 0 ||
    size.z <= 0
  ) {
    throw new Error(
      'Kitchen lighting requires finite, non-degenerate layout bounds',
    );
  }
  return sphere;
}

/** @returns {import('../sceneModule.js').SceneModule} */
export function createKitchenLightingModule({
  createEnvironmentMap = buildEnvironmentMap,
} = {}) {
  let cleanup;

  return {
    name: 'kitchen-lighting',
    build({ scene, renderer, signal, disposeResource }) {
      if (signal.aborted) return;
      const { center, radius } = getLayoutSphere(scene);
      const distance = 2.5 * radius;
      const root = new Group();
      root.name = LIGHTING_ROOT;
      const previousEnvironment = scene.environment;
      const previousIntensity = scene.environmentIntensity;
      let key;
      let environmentTarget;

      cleanup = () => {
        root.removeFromParent();
        if (
          environmentTarget &&
          scene.environment === environmentTarget.texture
        ) {
          scene.environment = previousEnvironment;
          scene.environmentIntensity = previousIntensity;
        }
        try {
          disposeResource(key);
        } finally {
          if (environmentTarget) disposeResource(environmentTarget);
        }
      };

      const ambient = new AmbientLight(0xffffff, 0.45);
      ambient.name = AMBIENT_LIGHT;
      // Inverse-square falloff gives the same centre illumination at every layout size.
      key = new SpotLight(
        0xffffff,
        1.7 * distance ** 2,
        0,
        1.25 * Math.asin(radius / distance),
        0.15,
        2,
      );
      key.name = KEY_SPOTLIGHT;
      key.target.name = 'lighting:key-target';
      key.target.position.copy(center);
      key.position
        .set(0.35, 1, 0.25)
        .normalize()
        .multiplyScalar(distance)
        .add(center);

      key.castShadow = true;
      const { shadow } = key;
      const mapSize = Math.min(1024, renderer.capabilities.maxTextureSize);
      shadow.mapSize.set(mapSize, mapSize);
      shadow.camera.near = distance - 1.1 * radius;
      shadow.camera.far = distance + 1.1 * radius;
      shadow.camera.updateProjectionMatrix();
      // The static kitchen and world-space light share one shadow pass across camera moves.
      shadow.autoUpdate = false;
      shadow.needsUpdate = true;

      environmentTarget = createEnvironmentMap(renderer, disposeResource);
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = 0.65;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.shadowMap.enabled = true;
      root.add(ambient, key, key.target);
      scene.add(root);
    },
    update() {},
    dispose() {
      const disposeLighting = cleanup;
      cleanup = undefined;
      disposeLighting?.();
    },
  };
}
