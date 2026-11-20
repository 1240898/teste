/* global jest -- Jest renderer double for the composed scene. */
import { ViewerEngine } from '../../../../src/visualization/scene/ViewerEngine.js';

// Canvas double with what the VIS07 OrbitControls needs to attach its listeners.
function canvasDouble() {
  const canvas = new EventTarget();
  const doc = { addEventListener() {}, removeEventListener() {} };
  return Object.assign(canvas, {
    style: {},
    ownerDocument: doc,
    getRootNode: () => doc,
    setPointerCapture() {},
    releasePointerCapture() {},
  });
}

export function createTestViewer() {
  const renderer = {
    capabilities: { maxTextureSize: 4096 },
    shadowMap: { enabled: false },
    setPixelRatio: jest.fn(),
    setSize: jest.fn(),
    render: jest.fn(),
    setAnimationLoop: jest.fn(),
    dispose: jest.fn(),
    forceContextLoss: jest.fn(),
  };
  const onFatalError = jest.fn();
  const engine = ViewerEngine.create(
    canvasDouble(),
    { clientWidth: 800, clientHeight: 450 },
    {
      onFatalError,
      rendererFactory: () => renderer,
      resizeObserverFactory: () => ({
        observe: jest.fn(),
        disconnect: jest.fn(),
      }),
    },
  );
  return { engine, renderer, onFatalError };
}
