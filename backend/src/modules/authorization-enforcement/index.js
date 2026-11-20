import { Router } from 'express';
import { SecurityAuditController } from './api/controllers/SecurityAuditController.js';
import { SecurityAuditRoutes } from './api/routes/SecurityAuditRoutes.js';
import { SecurityAuditService } from './application/services/SecurityAuditService.js';
import { SecurityAuditLogger } from './infrastructure/SecurityAuditLogger.js';
import { PostgresSecurityAuditRepository } from './infrastructure/PostgresSecurityAuditRepository.js';
import { AuthMiddleware } from '../user-authentication-management/api/middlewares/authMiddleware.js';

export function createAuthorizationEnforcementModule({
  database,
  userService,
  repository = new PostgresSecurityAuditRepository(database),
  outbox,
  logger,
} = {}) {
  if (!userService) throw new TypeError('User service is required');
  const service = new SecurityAuditService(repository);
  const router = Router();
  router.use(
    new SecurityAuditRoutes(
      new SecurityAuditController(service),
      new AuthMiddleware(userService),
    ).setupRoutes(),
  );
  return {
    router,
    repository,
    service,
    securityLogger: new SecurityAuditLogger({ repository, outbox, logger }),
  };
}

export function register(router, module) {
  if (module) router.use(module.router);
}
