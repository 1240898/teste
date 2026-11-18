import { defaultSceneModules } from '../../../src/visualization/scene/defaultSceneModules.js';

test('FT04 - the kitchen layout is the first default module and replaces the floor baseline', () => {
  const modules = defaultSceneModules.map((factory) => factory());
  expect(modules[0].name).toBe('kitchen-layout');
  expect(modules.map(({ name }) => name)).not.toContain('kitchen-floor');
});