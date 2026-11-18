import { Router } from 'express';
import { AuthMiddleware } from '../user-authentication-management/api/middlewares/authMiddleware.js';
import { ProductCategoryController } from './api/controllers/ProductCategoryController.js';
import { ProductCategoryRoutes } from './api/routes/ProductCategoryRoutes.js';
import { ProductCategoryService } from './application/services/ProductCategoryService.js';
import { ProductCategoryRepository } from './infrastructure/persistence/ProductCategoryRepository.js';

/**
 * Composition root of BCK03. Depends on BCK01 only through `userService`
 * (token verification for the AuthMiddleware).
 */
export function createProductCategoryModule({
  database,
  repository = new ProductCategoryRepository(database),
  userService,
} = {}) {
  const categoryService = new ProductCategoryService(repository);
  const router = Router();
  router.use(
    new ProductCategoryRoutes(
      new ProductCategoryController(categoryService),
      new AuthMiddleware(userService),
    ).setupRoutes(),
  );
  return { router, categoryService };
}

export function register(router, module) {
  // Production supplies the fully wired module before listening.
  if (module) router.use(module.router);
}
