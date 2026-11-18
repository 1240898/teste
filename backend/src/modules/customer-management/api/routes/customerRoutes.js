import { Router } from 'express';
import { AppError } from '../../../../shared/errors/AppError.js';
import { RoleMiddleware } from '../../../user-authentication-management/api/middlewares/roleMiddleware.js';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { schemas } from '../schemas.js';
export class CustomerRoutes {
  constructor(controller, authMiddleware) {
    Object.assign(this, { controller, authMiddleware });
  }
  setupRoutes() {
    const r = Router(),
      auth = this.authMiddleware.verifyToken,
      manager = RoleMiddleware.requireRole('MANAGER'),
      c = this.controller;
    r.use((_req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });
    const validateId = (req, _res, next) => {
      const { error, value } = schemas.id.validate(req.params.id);
      if (error) throw new AppError('Invalid customer id', 400);
      req.params.id = value;
      next();
    };
    const validateQuery = (req, _res, next) => {
      const { error } = schemas.search.validate(req.query, {
        convert: true,
      });
      if (error) throw new AppError('Invalid query parameters', 400);
      next();
    };
    r.post(
      '/customers',
      auth,
      manager,
      ValidationMiddleware.validate(schemas.create),
      c.create.bind(c),
    );
    r.get('/customers', auth, manager, validateQuery, c.search.bind(c));
    r.get('/customers/:id', auth, manager, validateId, c.getById.bind(c));
    r.put(
      '/customers/:id',
      auth,
      manager,
      validateId,
      ValidationMiddleware.validate(schemas.update),
      c.update.bind(c),
    );
    r.patch(
      '/customers/:id/deactivate',
      auth,
      manager,
      validateId,
      c.deactivate.bind(c),
    );
    r.patch(
      '/customers/:id/activate',
      auth,
      manager,
      validateId,
      c.activate.bind(c),
    );
    return r;
  }
}
