import { Router } from 'express';
import { AppError } from '../../../../shared/errors/AppError.js';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { RoleMiddleware } from '../../../user-authentication-management/api/middlewares/roleMiddleware.js';
import { schemas } from '../schemas.js';

// ValidationMiddleware only validates the body; query strings and route ids need
// their own schemas (Express 5 req.query is read-only, hence req.validated*).
function validatePart(part, schema) {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req[part] ?? {});
    if (error) throw new AppError(`Invalid request ${part}`, 400);
    req[`validated${part[0].toUpperCase()}${part.slice(1)}`] = value;
    next();
  };
}

/** Mounted under /api/v1/products by the module's composition root. */
export class ProductRoutes {
  constructor(productController, authMiddleware) {
    Object.assign(this, { productController, authMiddleware });
  }

  setupRoutes() {
    const router = Router();
    const controller = this.productController;
    const authenticate = this.authMiddleware.verifyToken;
    const manager = RoleMiddleware.requireRole('MANAGER');
    const staff = RoleMiddleware.requireRole('MANAGER', 'EMPLOYEE');
    const id = validatePart('params', schemas.id);

    router.post(
      '/',
      authenticate,
      manager,
      ValidationMiddleware.validate(schemas.create),
      controller.createProduct.bind(controller),
    );
    router.get(
      '/',
      authenticate,
      staff,
      validatePart('query', schemas.search),
      controller.listProducts.bind(controller),
    );
    router.get(
      '/:id',
      authenticate,
      staff,
      id,
      controller.getProductById.bind(controller),
    );
    router.put(
      '/:id',
      authenticate,
      manager,
      id,
      ValidationMiddleware.validate(schemas.update),
      controller.updateProduct.bind(controller),
    );
    router.delete(
      '/:id',
      authenticate,
      manager,
      id,
      controller.deactivateProduct.bind(controller),
    );
    router.patch(
      '/:id/activate',
      authenticate,
      manager,
      id,
      controller.activateProduct.bind(controller),
    );
    return router;
  }
}