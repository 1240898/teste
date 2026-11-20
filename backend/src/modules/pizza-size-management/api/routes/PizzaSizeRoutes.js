import { Router } from 'express';
import { AppError } from '../../../../shared/errors/AppError.js';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { RoleMiddleware } from '../../../user-authentication-management/api/middlewares/roleMiddleware.js';
import { schemas } from '../schemas.js';

export class PizzaSizeRoutes {
  constructor(controller, authMiddleware) {
    Object.assign(this, { controller, authMiddleware });
  }
  setupRoutes() {
    const router = Router();
    const auth = this.authMiddleware.verifyToken;
    const manager = RoleMiddleware.requireOperation('pizzaSizes.manage');
    const controller = this.controller;
    router.use((_req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });
    const validateId = (req, _res, next) => {
      const { error, value } = schemas.id.validate(req.params.id);
      if (error) throw new AppError('Invalid pizza size id', 400);
      req.params.id = value;
      next();
    };
    const validateQuery = (req, _res, next) => {
      const { error, value } = schemas.search.validate(req.query, {
        convert: true,
      });
      if (error) throw new AppError('Invalid query parameters', 400);
      req.validatedQuery = value;
      next();
    };
    router.post(
      '/pizza-sizes',
      auth,
      manager,
      ValidationMiddleware.validate(schemas.create),
      controller.create.bind(controller),
    );
    router.get(
      '/pizza-sizes',
      validateQuery,
      controller.search.bind(controller),
    );
    router.get(
      '/pizza-sizes/:id',
      validateId,
      controller.getById.bind(controller),
    );
    router.put(
      '/pizza-sizes/:id',
      auth,
      manager,
      validateId,
      ValidationMiddleware.validate(schemas.update),
      controller.update.bind(controller),
    );
    router.delete(
      '/pizza-sizes/:id',
      auth,
      manager,
      validateId,
      controller.delete.bind(controller),
    );
    return router;
  }
}
