import { Router } from 'express';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { schemas } from '../schemas.js';

export class PasswordRecoveryRoutes {
  constructor(controller, limiter) {
    Object.assign(this, { controller, limiter });
  }

  setupRoutes() {
    const router = Router();
    router.use((_req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });
    router.post(
      '/auth/password-recovery',
      this.limiter,
      ValidationMiddleware.validate(schemas.recoveryRequest),
      this.controller.requestRecovery.bind(this.controller),
    );
    router.post(
      '/auth/password-recovery/complete',
      this.limiter,
      ValidationMiddleware.validate(schemas.recoveryComplete),
      this.controller.completeRecovery.bind(this.controller),
    );
    return router;
  }
}
