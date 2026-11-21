import { AmbientLight, Group, MathUtils, Scene, SpotLight } from 'three';
import { createLightControlsModule } from '../../../../src/visualization/scene/modules/LightControlsModule.js';

function fixture() {
  const scene = new Scene();
  const root = new Group();
  root.name = 'lighting:root';
  const ambient = new AmbientLight(0xabcdef, 0.45);
  ambient.name = 'lighting:ambient';
  const key = new SpotLight(0xffffff, 120);
  key.castShadow = true;
  key.name = 'lighting:key';
  root.add(ambient, key);
  scene.add(new AmbientLight(), root);
  const controls = createLightControlsModule();
  const controller = new AbortController();
  controls.build({ scene, signal: controller.signal });
  const apply = (light, field, value) =>
    controls.apply(light.name, { field, value });
  return { controls, apply, ambient, key, root, controller };
}

test('binds both VIS05 sources, reads detached snapshots and retains the original baselines', () => {
  const { controls, apply, ambient, key } = fixture();
  expect(controls.bind()).toBe(true);
  const [a, s] = controls.getSources();
  expect(a).toEqual({
    id: ambient.name,
    kind: 'ambient',
    enabled: true,
    colour: '#abcdef',
    intensityMultiplier: 1,
  });
  expect(s).toMatchObject({
    id: key.name,
    kind: 'spot',
    cutoffDegrees: expect.closeTo(60),
    penumbra: 0,
  });
  a.enabled = false;
  expect(ambient.visible).toBe(true);
  for (const light of [ambient, key]) {
    const baseline = light.intensity;
    for (const value of [0, 1, 2]) {
      expect(apply(light, 'intensityMultiplier', value)).toBe(true);
      expect(light.intensity).toBe(value * baseline);
      expect(light.visible).toBe(true);
      expect(controls.bind()).toBe(true);
    }
    expect(apply(light, 'colour', '#aBcD01')).toBe(true);
    expect(light.color.getHexString()).toBe('abcd01');
  }
});

test('lights switch independently and reject edits while disabled', () => {
  const { controls, apply, ambient, key } = fixture();
  controls.bind();
  for (const light of [ambient, key]) {
    apply(light, 'intensityMultiplier', 1.5);
    expect(apply(light, 'enabled', false)).toBe(true);
    const snapshot = controls.getSources();
    for (const [field, value] of [
      ['colour', '#aaaaaa'],
      ['intensityMultiplier', 0],
      ['cutoffDegrees', 10],
      ['penumbra', 0.5],
    ]) {
      expect(apply(light, field, value)).toBe(false);
    }
    expect(controls.getSources()).toEqual(snapshot);
    expect((light === key ? ambient : key).visible).toBe(true);
    expect(apply(light, 'enabled', true)).toBe(true);
    expect(
      controls.getSources().find((source) => source.id === light.name)
        .intensityMultiplier,
    ).toBe(1.5);
  }
});

test('only a changed cutoff or re-enabling the shadow-casting spotlight invalidates the shadow map', () => {
  const { controls, apply, key, ambient } = fixture();
  controls.bind();
  for (const degrees of [1, 75]) {
    key.shadow.needsUpdate = false;
    expect(apply(key, 'cutoffDegrees', degrees)).toBe(true);
    expect(key.angle).toBe(MathUtils.degToRad(degrees));
    expect(key.shadow.needsUpdate).toBe(true);
    key.shadow.needsUpdate = false;
    expect(apply(key, 'cutoffDegrees', degrees)).toBe(true);
    expect(key.shadow.needsUpdate).toBe(false);
  }
  for (const value of [0, 1]) expect(apply(key, 'penumbra', value)).toBe(true);
  apply(key, 'colour', '#000000');
  apply(key, 'intensityMultiplier', 0);
  apply(ambient, 'enabled', false);
  apply(ambient, 'enabled', true);
  apply(key, 'enabled', false);
  expect(key.shadow.needsUpdate).toBe(false);
  apply(key, 'enabled', true);
  expect(key.shadow.needsUpdate).toBe(true);
});

test('invalid commands preserve all live values', () => {
  const { controls, apply, key, ambient } = fixture();
  controls.bind();
  const before = controls.getSources();
  for (const [field, value] of [
    ['cutoffDegrees', 0],
    ['cutoffDegrees', 75.01],
    ['penumbra', NaN],
    ['penumbra', 1.1],
    ['intensityMultiplier', Infinity],
    ['intensityMultiplier', -1],
    ['intensityMultiplier', '0'],
    ['colour', '#12'],
    ['enabled', 1],
    ['other', true],
  ]) {
    expect(apply(key, field, value)).toBe(false);
  }
  expect(apply(ambient, 'penumbra', 1)).toBe(false);
  expect(apply(ambient, 'cutoffDegrees', 45)).toBe(false);
  expect(controls.apply('missing', { field: 'enabled', value: false })).toBe(
    false,
  );
  expect(controls.getSources()).toEqual(before);
});

test.each([
  'missing',
  'duplicate',
  'incompatible',
  'bad cutoff',
  'bad baseline',
  'aborted',
  'disposed',
])('never publishes partial or stale bindings (%s)', (reason) => {
  const { controls, apply, key, ambient, root, controller } = fixture();
  if (reason === 'missing') root.remove(key);
  if (reason === 'duplicate') root.add(key.clone());
  if (reason === 'incompatible') {
    root.remove(key);
    const wrong = new Group();
    wrong.name = key.name;
    root.add(wrong);
  }
  if (reason === 'bad cutoff') key.angle = MathUtils.degToRad(0.5);
  if (reason === 'bad baseline') key.intensity = 0;
  if (reason === 'aborted') controller.abort();
  if (reason === 'disposed') {
    controls.bind();
    controls.dispose();
    controls.dispose();
  }
  expect(controls.bind()).toBe(false);
  expect(controls.getSources()).toEqual([]);
  expect(apply(ambient, 'enabled', false)).toBe(false);
  expect(ambient.visible).toBe(true);
});
