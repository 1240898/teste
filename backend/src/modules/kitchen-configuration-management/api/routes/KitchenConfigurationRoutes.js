import { Router } from 'express';
import { AppError } from '../../../../shared/errors/AppError.js';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { RoleMiddleware } from '../../../user-authentication-management/api/middlewares/roleMiddleware.js';
import { schemas } from '../schemas.js';

function validateParams(schema) {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req.params ?? {});
    if (error) throw new AppError('Invalid request params', 400);
    req.validatedParams = value;
    next();
  };
}

/**
 * Mounted under /api/v1/kitchen-configurations. Every route:
 * verifyToken -> requireRole(...) -> joi envelope -> controller (BR 1).
 * "/active" and "/validation" are declared before "/:id".
 */
export class KitchenConfigurationRoutes {
  constructor(controller, authMiddleware) {
    Object.assign(this, { controller, authMiddleware });
  }

  setupRoutes() {
    const router = Router();
    const controller = this.controller;
    const authenticate = this.authMiddleware.verifyToken;
    const manager = RoleMiddleware.requireRole('MANAGER');
    const viewer = RoleMiddleware.requireRole('MANAGER', 'EMPLOYEE');
    const id = validateParams(schemas.id);
    const handle = (name) => controller[name].bind(controller);

    router.get('/', authenticate, manager, handle('listConfigurations'));
    router.get(
      '/active',
      authenticate,
      viewer,
      handle('getActiveConfiguration'),
    );
    router.post(
      '/validation',
      authenticate,
      manager,
      ValidationMiddleware.validate(schemas.validate),
      handle('validateContent'),
    );
    router.post(
      '/',
      authenticate,
      manager,
      ValidationMiddleware.validate(schemas.create),
      handle('createConfiguration'),
    );
    router.get('/:id', authenticate, manager, id, handle('getConfiguration'));
    router.put(
      '/:id',
      authenticate,
      manager,
      id,
      ValidationMiddleware.validate(schemas.update),
      handle('updateConfiguration'),
    );
    router.delete(
      '/:id',
      authenticate,
      manager,
      id,
      handle('deleteConfiguration'),
    );
    router.post(
      '/:id/activation',
      authenticate,
      manager,
      id,
      handle('activateConfiguration'),
    );
    return router;
  }
}