import { Router } from 'express';
import { RoleMiddleware } from '../../../user-authentication-management/api/middlewares/roleMiddleware.js';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { schemas } from '../schemas.js';

export class ProductCategoryRoutes {
  constructor(categoryController, authMiddleware) {
    Object.assign(this, { categoryController, authMiddleware });
  }
  setupRoutes() {
    const router = Router();
    const controller = this.categoryController;
    const authenticate = this.authMiddleware.verifyToken;
    const manager = RoleMiddleware.requireRole('MANAGER');
    // BR2: reads are public; writes require an authenticated MANAGER.
    router.get('/categories', controller.getAllCategories.bind(controller));
    router.get('/categories/:id', controller.getCategoryById.bind(controller));
    router.post(
      '/categories',
      authenticate,
      manager,
      ValidationMiddleware.validate(schemas.create),
      controller.createCategory.bind(controller),
    );
    router.put(
      '/categories/:id',
      authenticate,
      manager,
      ValidationMiddleware.validate(schemas.update),
      controller.updateCategory.bind(controller),
    );
    router.delete(
      '/categories/:id',
      authenticate,
      manager,
      controller.deleteCategory.bind(controller),
    );
    return router;
  }
}
