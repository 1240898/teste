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
    const authenticateOptional =
      this.authMiddleware.verifyOptionalToken ??
      ((req, res, next) =>
        req.headers.authorization || req.headers['x-access-token']
          ? authenticate(req, res, next)
          : next());
    const create = RoleMiddleware.requireOperation('products.create');
    const staff = RoleMiddleware.requireOperation('products.read');
    const update = RoleMiddleware.requireOperation('products.update');
    const deactivate = RoleMiddleware.requireOperation('products.deactivate');
    const activate = RoleMiddleware.requireOperation('products.activate');
    const id = validatePart('params', schemas.id);

    router.post(
      '/',
      authenticate,
      create,
      ValidationMiddleware.validate(schemas.create),
      controller.createProduct.bind(controller),
    );
    router.get(
      '/',
      authenticateOptional,
      staff,
      validatePart('query', schemas.search),
      controller.listProducts.bind(controller),
    );
    router.get(
      '/:id',
      authenticateOptional,
      staff,
      id,
      controller.getProductById.bind(controller),
    );
    router.put(
      '/:id',
      authenticate,
      update,
      id,
      ValidationMiddleware.validate(schemas.update),
      controller.updateProduct.bind(controller),
    );
    router.delete(
      '/:id',
      authenticate,
      deactivate,
      id,
      controller.deactivateProduct.bind(controller),
    );
    router.patch(
      '/:id/activate',
      authenticate,
      activate,
      id,
      controller.activateProduct.bind(controller),
    );
    return router;
  }
}
