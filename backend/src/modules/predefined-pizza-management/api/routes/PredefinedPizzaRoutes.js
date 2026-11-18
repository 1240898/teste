import { Router } from 'express';
import { AppError } from '../../../../shared/errors/AppError.js';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { RoleMiddleware } from '../../../user-authentication-management/api/middlewares/roleMiddleware.js';
import { schemas } from '../schemas.js';

function validateParams(schema) {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req.params);
    if (error) throw new AppError('Invalid request params', 400);
    req.validatedParams = value;
    next();
  };
}

export class PredefinedPizzaRoutes {
  constructor(controller, authMiddleware) {
    Object.assign(this, { controller, authMiddleware });
  }

  setupRoutes() {
    const router = Router();
    const auth = this.authMiddleware.verifyToken;
    const manager = RoleMiddleware.requireRole('MANAGER');
    const controller = this.controller;

    router.post(
      '/',
      auth,
      manager,
      ValidationMiddleware.validate(schemas.create),
      controller.create.bind(controller),
    );
    router.get('/', auth, manager, controller.list.bind(controller));
    router.get(
      '/:productId',
      auth,
      manager,
      validateParams(schemas.id),
      controller.getById.bind(controller),
    );
    router.put(
      '/:productId/default-configuration',
      auth,
      manager,
      validateParams(schemas.id),
      ValidationMiddleware.validate(schemas.replaceConfiguration),
      controller.replaceConfiguration.bind(controller),
    );
    return router;
  }
}
