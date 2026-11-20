import { defaultSceneModules } from '../../../src/visualization/scene/defaultSceneModules.js';

test('FT04 - the kitchen layout is the first default module and replaces the floor baseline', () => {
  const modules = defaultSceneModules.map((factory) => factory());
  expect(modules[0].name).toBe('kitchen-layout');
  expect(modules.map(({ name }) => name)).not.toContain('kitchen-floor');
});

test('IT-1 - camera-controls is the last default module (VIS07)', () => {
  const names = defaultSceneModules.map((factory) => factory().name);
  expect(names[0]).toBe('kitchen-layout');
  expect(names.at(-1)).toBe('camera-controls');
});

test('VIS05 builds one kitchen light module after geometry and before camera controls', () => {
  const names = defaultSceneModules.map((factory) => factory().name);
  expect(names.filter((name) => name === 'kitchen-lighting')).toHaveLength(1);
  expect(names).not.toContain('base-lighting');
  expect(names.indexOf('assembly-line')).toBeGreaterThan(
    names.indexOf('kitchen-layout'),
  );
  expect(names.indexOf('kitchen-lighting')).toBeGreaterThan(
    names.indexOf('assembly-line'),
  );
  expect(names.indexOf('camera-controls')).toBeGreaterThan(
    names.indexOf('kitchen-lighting'),
  );
});
