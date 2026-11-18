import { Router } from 'express';
import { AuthMiddleware } from '../user-authentication-management/api/middlewares/authMiddleware.js';
import { AllergenController } from './api/controllers/AllergenController.js';
import { AllergenRoutes } from './api/routes/AllergenRoutes.js';
import { AllergenService } from './application/services/AllergenService.js';
import { AllergenRepository } from './infrastructure/persistence/AllergenRepository.js';

/**
 * Composition root of BCK04. Depends on BCK01 only through `userService`
 * (token verification for the AuthMiddleware).
 */
export function createAllergenModule({
  database,
  repository = new AllergenRepository(database),
  userService,
} = {}) {
  const allergenService = new AllergenService(repository);
  const router = Router();
  router.use(
    new AllergenRoutes(
      new AllergenController(allergenService),
      new AuthMiddleware(userService),
    ).setupRoutes(),
  );
  return { router, allergenService };
}

export function register(router, module) {
  // Production supplies the fully wired module before listening.
  if (module) router.use(module.router);
}