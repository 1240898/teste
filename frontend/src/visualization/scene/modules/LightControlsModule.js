import { MathUtils } from 'three';
import {
  AMBIENT_LIGHT,
  KEY_SPOTLIGHT,
  LIGHTING_ROOT,
} from '../sceneObjectNames.js';

export const MAX_INTENSITY_MULTIPLIER = 2;
export const MIN_CUTOFF_DEGREES = 1;
export const MAX_CUTOFF_DEGREES = 75;

const inRange = (value, min, max) =>
  Number.isFinite(value) && value >= min && value <= max;

function onlyChild(parent, name) {
  const matches = parent?.children.filter((child) => child.name === name);
  return matches?.length === 1 ? matches[0] : undefined;
}

function snapshot({ light, baseline }) {
  const source = {
    id: light.name,
    kind: light.isSpotLight ? 'spot' : 'ambient',
    enabled: light.visible,
    colour: '#' + light.color.getHexString(),
    intensityMultiplier: light.intensity / baseline,
  };
  if (light.isSpotLight) {
    source.cutoffDegrees = MathUtils.radToDeg(light.angle);
    source.penumbra = light.penumbra;
  }
  return source;
}

/** Borrows the VIS05 lights for one attempt. The engine owns their lifetime. */
export function createLightControlsModule() {
  let scene;
  let signal;
  const bindings = new Map();

  return {
    name: 'light-controls',
    build(context) {
      if (context.signal.aborted) return;
      scene = context.scene;
      signal = context.signal;
    },
    bind() {
      if (!scene || signal.aborted) return false;
      if (bindings.size) return true;
      const root = onlyChild(scene, LIGHTING_ROOT);
      const ambient = onlyChild(root, AMBIENT_LIGHT);
      const key = onlyChild(root, KEY_SPOTLIGHT);
      if (
        !ambient?.isAmbientLight ||
        !key?.isSpotLight ||
        ![ambient, key].every(
          (light) => Number.isFinite(light.intensity) && light.intensity > 0,
        ) ||
        !inRange(
          key.angle,
          MathUtils.degToRad(MIN_CUTOFF_DEGREES),
          MathUtils.degToRad(MAX_CUTOFF_DEGREES),
        ) ||
        !inRange(key.penumbra, 0, 1)
      )
        return false;
      for (const light of [ambient, key])
        bindings.set(light.name, { light, baseline: light.intensity });
      return true;
    },
    getSources() {
      return signal?.aborted ? [] : Array.from(bindings.values(), snapshot);
    },
    apply(id, change) {
      const binding = bindings.get(id);
      if (!binding || signal.aborted || !change) return false;
      const { light, baseline } = binding;
      const { field, value } = change;
      if (field === 'enabled') {
        if (typeof value !== 'boolean') return false;
        if (light.castShadow && !light.visible && value)
          light.shadow.needsUpdate = true;
        light.visible = value;
        return true;
      }
      if (!light.visible) return false;
      switch (field) {
        case 'colour':
          if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
            return false;
          light.color.setHex(Number.parseInt(value.slice(1), 16));
          break;
        case 'intensityMultiplier':
          if (!inRange(value, 0, MAX_INTENSITY_MULTIPLIER)) return false;
          light.intensity = baseline * value;
          break;
        case 'cutoffDegrees': {
          if (
            !light.isSpotLight ||
            !inRange(value, MIN_CUTOFF_DEGREES, MAX_CUTOFF_DEGREES)
          )
            return false;
          const radians = MathUtils.degToRad(value);
          if (light.castShadow && radians !== light.angle)
            light.shadow.needsUpdate = true;
          light.angle = radians;
          break;
        }
        case 'penumbra':
          if (!light.isSpotLight || !inRange(value, 0, 1)) return false;
          light.penumbra = value;
          break;
        default:
          return false;
      }
      return true;
    },
    update() {},
    dispose() {
      bindings.clear();
      scene = undefined;
      signal = undefined;
    },
  };
}
