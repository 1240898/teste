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

export class StockRoutes {
  constructor(controller, authMiddleware) {
    Object.assign(this, { controller, authMiddleware });
  }

  register(router) {
    const auth = this.authMiddleware.verifyToken;
    const manager = RoleMiddleware.requireOperation('stock.manage');
    const controller = this.controller;

    router.post(
      '/stock',
      auth,
      manager,
      ValidationMiddleware.validate(schemas.startTracking),
      controller.startTracking.bind(controller),
    );
    router.delete(
      '/stock/:productId',
      auth,
      manager,
      validatePart('params', schemas.productParams),
      controller.stopTracking.bind(controller),
    );
    router.get(
      '/stock/:productId',
      auth,
      manager,
      validatePart('params', schemas.productParams),
      controller.getForProduct.bind(controller),
    );
    router.get(
      '/stock',
      auth,
      manager,
      validatePart('query', schemas.search),
      controller.search.bind(controller),
    );
    router.post(
      '/stock/:productId/adjustments',
      auth,
      manager,
      validatePart('params', schemas.productParams),
      ValidationMiddleware.validate(schemas.adjustment),
      controller.adjust.bind(controller),
    );
    return router;
  }

  static createRouter(controller, authMiddleware) {
    return new StockRoutes(controller, authMiddleware).register(Router());
  }
}
