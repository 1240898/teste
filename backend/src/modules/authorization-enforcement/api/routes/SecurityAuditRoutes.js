import { Router } from 'express';
import { AppError } from '../../../../shared/errors/AppError.js';
import { RoleMiddleware } from '../middlewares/RoleMiddleware.js';
import { schemas } from '../schemas.js';

export class SecurityAuditRoutes {
  constructor(controller, authMiddleware) {
    this.controller = controller;
    this.authMiddleware = authMiddleware;
  }

  setupRoutes() {
    const router = Router();
    const validateQuery = (req, _res, next) => {
      const { error, value } = schemas.search.validate(req.query, {
        convert: true,
      });
      if (error) throw new AppError('Invalid query parameters', 400);
      req.validatedQuery = {
        ...value,
        from: value.from?.toISOString(),
        to: value.to?.toISOString(),
      };
      next();
    };

    router.get(
      '/security/audit-logs',
      this.authMiddleware.verifyToken,
      RoleMiddleware.requireOperation('securityAudit.read'),
      validateQuery,
      this.controller.search.bind(this.controller),
    );
    return router;
  }
}
