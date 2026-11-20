import { Router } from 'express';
import { RoleMiddleware } from '../middlewares/roleMiddleware.js';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { schemas } from '../schemas.js';

export class UserRoutes {
  constructor(userController, authMiddleware, limiter) {
    Object.assign(this, { userController, authMiddleware, limiter });
  }
  setupRoutes() {
    const router = Router();

    const controller = this.userController;
    const authenticate = this.authMiddleware.verifyToken;
    const administrator = RoleMiddleware.requireOperation('users.manage');
    router.use((_req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });
    router.post(
      '/users/register',
      this.limiter,
      ValidationMiddleware.validate(schemas.register),
      controller.register.bind(controller),
    );
    router.post(
      '/users/invitations',
      authenticate,
      administrator,
      ValidationMiddleware.validate(schemas.inviteWorker),
      controller.inviteWorker.bind(controller),
    );
    router.get(
      '/users',
      authenticate,
      administrator,
      ValidationMiddleware.validate(schemas.userList, 'query'),
      controller.getAll.bind(controller),
    );
    router.get(
      '/users/:id',
      authenticate,
      administrator,
      controller.getById.bind(controller),
    );
    router.patch(
      '/users/:id/roles',
      authenticate,
      administrator,
      ValidationMiddleware.validate(schemas.roles),
      controller.updateRoles.bind(controller),
    );
    router.delete(
      '/users/:id',
      authenticate,
      administrator,
      controller.deactivate.bind(controller),
    );
    router.patch(
      '/users/:id/activation',
      authenticate,
      administrator,
      ValidationMiddleware.validate(schemas.activation),
      controller.reactivate.bind(controller),
    );
    router.post(
      '/users/:id/activation-invitations',
      authenticate,
      administrator,
      (req, _res, next) => {
        req.body ??= {};
        next();
      },
      ValidationMiddleware.validate(schemas.invitationReplacement),
      controller.issueInvitation.bind(controller),
    );
    return router;
  }
}
