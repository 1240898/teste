import { jest } from '@jest/globals';
import { createCameraControlsModule } from '../../../../src/visualization/scene/modules/CameraControlsModule.js';

function context({ aborted = false } = {}) {
  return {
    camera: {},
    domElement: {},
    signal: { aborted },
    configuration: { content: { kitchen: {} } },
  };
}

function fakeController() {
  return { update: jest.fn(), dispose: jest.fn() };
}

test('build() creates the controller with the camera, canvas and layout', () => {
  const controller = fakeController();
  const createController = jest.fn(() => controller);
  const module = createCameraControlsModule({ createController });
  const ctx = context();

  module.build(ctx);

  expect(createController).toHaveBeenCalledWith(
    ctx.camera,
    ctx.domElement,
    ctx.configuration.content,
  );
});

test('update() advances the controller every frame', () => {
  const controller = fakeController();
  const module = createCameraControlsModule({ createController: () => controller });
  module.build(context());
  module.update(0.016);
  module.update(0.016);
  expect(controller.update).toHaveBeenCalledTimes(2);
});

test('dispose() releases the controller once; update() afterwards does nothing', () => {
  const controller = fakeController();
  const module = createCameraControlsModule({ createController: () => controller });
  module.build(context());

  module.dispose();
  module.dispose();
  module.update(0.016);

  expect(controller.dispose).toHaveBeenCalledTimes(1);
  expect(controller.update).not.toHaveBeenCalled();
});

test('nothing is created for an aborted build, and dispose() is safe', () => {
  const createController = jest.fn();
  const module = createCameraControlsModule({ createController });
  module.build(context({ aborted: true }));
  expect(createController).not.toHaveBeenCalled();
  expect(() => module.dispose()).not.toThrow();
});