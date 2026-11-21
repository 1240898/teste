import { Router } from 'express';
import { ValidationMiddleware } from '../../../../shared/validation/ValidationMiddleware.js';
import { schemas } from '../schemas.js';

export class AuthRoutes {
  constructor(authController, limiter, authMiddleware) {
    Object.assign(this, { authController, limiter, authMiddleware });
  }
  setupRoutes() {
    const router = Router();
    const controller = this.authController;
    router.use((_req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });
    router.post(
      '/auth/login',
      this.limiter,
      ValidationMiddleware.validate(schemas.login),
      controller.login.bind(controller),
    );
    router.post('/auth/renew', controller.renew.bind(controller));
    router.post('/auth/resume', controller.resume.bind(controller));
    router.post('/auth/logout', controller.logout.bind(controller));
    // AA03: the SPA obtains the current internal roles from the back end.
    router.get(
      '/auth/me',
      this.authMiddleware.verifyToken,
      controller.getCurrentUser.bind(controller),
    );
    // GDP01 (G4): self-service marketing consent (Table 1, Customer role).
    router.put(
      '/auth/me/marketing-consent',
      this.authMiddleware.verifyToken,
      ValidationMiddleware.validate(schemas.marketingConsent),
      controller.updateMarketingConsent.bind(controller),
    );
    // AA01: change of the local password by the authenticated user.
    router.patch(
      '/auth/password',
      this.authMiddleware.verifyToken,
      ValidationMiddleware.validate(schemas.passwordChange),
      controller.changePassword.bind(controller),
    );
    // AA02: public Google sign-in routes, registered only when Google is configured.
    if (controller.externalAuthService) {
      router.post(
        '/auth/google/authorization',
        this.limiter,
        controller.startGoogleLogin.bind(controller),
      );
      router.post(
        '/auth/google/callback',
        this.limiter,
        ValidationMiddleware.validate(schemas.googleCallback),
        controller.completeGoogleLogin.bind(controller),
      );
    }
    return router;
  }
}
