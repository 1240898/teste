import { Router } from 'express';
import { AuthMiddleware } from '../user-authentication-management/api/middlewares/authMiddleware.js';
import { PizzaSizeController } from './api/controllers/PizzaSizeController.js';
import { PizzaSizeRoutes } from './api/routes/PizzaSizeRoutes.js';
import { PizzaSizeService } from './application/services/PizzaSizeService.js';
import { PizzaSizeRepository } from './infrastructure/persistence/PizzaSizeRepository.js';

export function createPizzaSizeModule({
  database,
  userService,
  repository = new PizzaSizeRepository(database),
  authMiddleware = new AuthMiddleware(userService),
} = {}) {
  const service = new PizzaSizeService(repository);
  const router = Router();
  router.use(new PizzaSizeRoutes(new PizzaSizeController(service), authMiddleware).setupRoutes());
  return { router, pizzaSizeService: service, repository };
}

export function register(router, module) {
  if (module) router.use(module.router);
}
