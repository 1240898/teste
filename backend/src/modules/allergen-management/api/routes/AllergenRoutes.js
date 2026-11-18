import { Router } from 'express';
import { RoleMiddleware } from '../../../user-authentication-management/api/middlewares/roleMiddleware.js';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { schemas } from '../schemas.js';

export class AllergenRoutes {
  constructor(allergenController, authMiddleware) {
    Object.assign(this, { allergenController, authMiddleware });
  }
  setupRoutes() {
    const router = Router();
    const controller = this.allergenController;
    const authenticate = this.authMiddleware.verifyToken;
    const manager = RoleMiddleware.requireRole('MANAGER');
    // BR2: reads are public; writes require an authenticated MANAGER.
    router.get('/allergens', controller.getAllAllergens.bind(controller));
    router.get('/allergens/:id', controller.getAllergenById.bind(controller));
    router.post(
      '/allergens',
      authenticate,
      manager,
      ValidationMiddleware.validate(schemas.register),
      controller.createAllergen.bind(controller),
    );
    router.put(
      '/allergens/:id',
      authenticate,
      manager,
      ValidationMiddleware.validate(schemas.update),
      controller.updateAllergen.bind(controller),
    );
    router.delete(
      '/allergens/:id',
      authenticate,
      manager,
      controller.deleteAllergen.bind(controller),
    );
    return router;
  }
}