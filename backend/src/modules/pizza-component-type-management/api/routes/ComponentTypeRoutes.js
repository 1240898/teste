import { Router } from 'express';
import { AppError } from '../../../../shared/errors/AppError.js';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { RoleMiddleware } from '../../../user-authentication-management/api/middlewares/roleMiddleware.js';
import { schemas } from '../schemas.js';

function validatePart(part, schema) {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req[part]);
    if (error) throw new AppError(`Invalid request ${part}`, 400);
    req[`validated${part[0].toUpperCase()}${part.slice(1)}`] = value;
    next();
  };
}

export class ComponentTypeRoutes {
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
    router.get(
      '/',
      auth,
      manager,
      validatePart('query', schemas.search),
      controller.search.bind(controller),
    );
    router.get(
      '/:id',
      auth,
      manager,
      validatePart('params', schemas.id),
      controller.getById.bind(controller),
    );
    router.patch(
      '/:id',
      auth,
      manager,
      validatePart('params', schemas.id),
      ValidationMiddleware.validate(schemas.update),
      controller.update.bind(controller),
    );
    router.delete(
      '/:id',
      auth,
      manager,
      validatePart('params', schemas.id),
      controller.remove.bind(controller),
    );
    return router;
  }
}
