import { Router } from 'express';
import { RoleMiddleware } from '../../../user-authentication-management/api/middlewares/roleMiddleware.js';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { schemas } from '../schemas.js';

export class ComponentConfigurationRoutes {
  constructor(controller, authMiddleware) {
    Object.assign(this, { controller, authMiddleware });
  }

  setupRoutes() {
    const router = Router();
    const auth = this.authMiddleware.verifyToken;
    const manager = RoleMiddleware.requireOperation('componentConfigurations.manage');
    const controller = this.controller;

    router.post(
      '/:productId/component-configurations/:sizeId',
      auth,
      manager,
      ValidationMiddleware.validate(schemas.create),
      controller.create.bind(controller),
    );
    router.patch(
      '/:productId/component-configurations/:sizeId',
      auth,
      manager,
      ValidationMiddleware.validate(schemas.update),
      controller.update.bind(controller),
    );
    router.get(
      '/:productId/component-configurations',
      auth,
      manager,
      controller.consult.bind(controller),
    );
    return router;
  }
}
