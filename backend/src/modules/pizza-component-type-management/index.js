import { Router } from 'express';
import { ComponentTypeController } from './api/controllers/ComponentTypeController.js';
import { ComponentTypeRoutes } from './api/routes/ComponentTypeRoutes.js';
import { ComponentTypeService } from './application/services/ComponentTypeService.js';
import { PostgresComponentTypeRepository } from './infrastructure/persistence/PostgresComponentTypeRepository.js';
import { PostgresComponentTypeImpactGuard } from './infrastructure/persistence/PostgresComponentTypeImpactGuard.js';
import { PostgresUnitOfWork } from '../../shared/persistence/postgres/PostgresUnitOfWork.js';

export function createPizzaComponentTypeModule({
  database,
  authMiddleware,
  repository,
  unitOfWork,
  impactGuard = new PostgresComponentTypeImpactGuard(),
} = {}) {
  const persistenceRepository =
    repository ??
    (database ? new PostgresComponentTypeRepository(database) : undefined);
  const transactionBoundary =
    unitOfWork ?? (database ? new PostgresUnitOfWork(database) : undefined);
  if (!persistenceRepository || !transactionBoundary)
    throw new TypeError('A database or component type repository is required');
  if (!authMiddleware)
    throw new TypeError('BCK01 authentication middleware is required');
  const service = new ComponentTypeService(
    persistenceRepository,
    transactionBoundary,
    impactGuard,
  );
  const controller = new ComponentTypeController(service);
  const router = Router();
  router.use(
    '/pizza-component-types',
    new ComponentTypeRoutes(controller, authMiddleware).setupRoutes(),
  );
  return {
    router,
    service,
    repository: persistenceRepository,
    unitOfWork: transactionBoundary,
    impactGuard,
  };
}

export function register(router, module) {
  if (module) router.use(module.router);
}
