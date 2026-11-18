import { isWebGLAvailable } from '../../../src/visualization/scene/webglSupport.js';

test('probes WebGL 2 once on a disposable canvas', () => {
  const loseContext = jest.fn();
  const getContext = jest.fn(() => ({ getExtension: () => ({ loseContext }) }));
  expect(isWebGLAvailable(() => ({ getContext }))).toBe(true);
  expect(getContext).toHaveBeenCalledWith('webgl2');
  expect(loseContext).toHaveBeenCalledTimes(1);
});

test('handles absent, already-lost and throwing contexts', () => {
  expect(isWebGLAvailable(() => ({ getContext: () => null }))).toBe(false);
  expect(
    isWebGLAvailable(() => ({
      getContext: () => ({ isContextLost: () => true }),
    })),
  ).toBe(false);
  expect(
    isWebGLAvailable(() => {
      throw new Error();
    }),
  ).toBe(false);
});
