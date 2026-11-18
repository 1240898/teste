import { Router } from 'express';
import { PostgresUnitOfWork } from '../../shared/persistence/postgres/PostgresUnitOfWork.js';
import { AuthMiddleware } from '../user-authentication-management/api/middlewares/authMiddleware.js';
import { ProductController } from './api/controllers/ProductController.js';
import { ProductRoutes } from './api/routes/ProductRoutes.js';
import { ProductService } from './application/services/ProductService.js';
import { ProductImpactChecker } from './infrastructure/persistence/ProductImpactChecker.js';
import { ProductReferenceReader } from './infrastructure/persistence/ProductReferenceReader.js';
import { ProductRepository } from './infrastructure/persistence/ProductRepository.js';

/**
 * Composition root of BCK05. Depends on BCK01 only through the AuthMiddleware (or the
 * userService used to build it). Every port can be replaced (tests use in-memory doubles).
 */
export function createProductManagementModule({
  database,
  authMiddleware,
  userService,
  repository,
  referenceReader,
  impactChecker,
  unitOfWork,
} = {}) {
  const ports = {
    productRepository:
      repository ?? (database ? new ProductRepository(database) : undefined),
    referenceReader:
      referenceReader ??
      (database ? new ProductReferenceReader(database) : undefined),
    impactChecker:
      impactChecker ?? (database ? new ProductImpactChecker(database) : undefined),
    unitOfWork:
      unitOfWork ?? (database ? new PostgresUnitOfWork(database) : undefined),
  };
  for (const [name, port] of Object.entries(ports))
    if (!port) throw new TypeError(`A database or a ${name} is required`);
  const auth =
    authMiddleware ?? (userService ? new AuthMiddleware(userService) : undefined);
  if (!auth) throw new TypeError('BCK01 authentication middleware is required');

  const productService = new ProductService(ports);
  const router = Router();
  router.use(
    '/products',
    new ProductRoutes(new ProductController(productService), auth).setupRoutes(),
  );
  return { router, productService, ...ports };
}

export function register(router, module) {
  // Production supplies the fully wired module before listening.
  if (module) router.use(module.router);
}
