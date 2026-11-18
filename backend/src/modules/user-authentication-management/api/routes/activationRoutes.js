import { Router } from 'express';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { schemas } from '../schemas.js';

export function createActivationRoutes(controller, limiter) {
  const router = Router();
  for (const [path, schema, action] of [
    ['inspect', schemas.activationInvitation, controller.inspect],
    ['local', schemas.localActivation, controller.local],
    ['external/start', schemas.activationInvitation, controller.startExternal],
    ['external/complete', schemas.googleCallback, controller.completeExternal],
  ]) {
    router.post(
      `/users/activation/${path}`,
      limiter,
      ValidationMiddleware.validate(schema),
      action.bind(controller),
    );
  }
  return router;
}
