import { Router } from 'express';
import { ComponentConfigurationController } from './api/controllers/ComponentConfigurationController.js';
import { ComponentConfigurationRoutes } from './api/routes/ComponentConfigurationRoutes.js';
import { ComponentSizeConfigurationService } from './application/services/ComponentSizeConfigurationService.js';
import { PostgresComponentConfigurationRepository } from './infrastructure/persistence/PostgresComponentConfigurationRepository.js';
import { ComponentConfigurationImpactGuard } from './infrastructure/persistence/ComponentConfigurationImpactGuard.js';
import { PostgresUnitOfWork } from '../../shared/persistence/postgres/PostgresUnitOfWork.js';
import { PostgresStockRepository } from '../stock-information-management/infrastructure/persistence/PostgresStockRepository.js';

export function createPizzaComponentConfigurationModule({
  database,
  authMiddleware,
  repository,
  products,
  sizes,
  unitOfWork,
  impactGuard = database ? new ComponentConfigurationImpactGuard() : undefined,
} = {}) {
  const persistenceRepository =
    repository ??
    (database
      ? new PostgresComponentConfigurationRepository(database, {
          products,
          sizes,
        })
      : undefined);
  const transactionBoundary =
    unitOfWork ?? (database ? new PostgresUnitOfWork(database) : undefined);
  if (!persistenceRepository || !transactionBoundary)
    throw new TypeError(
      'A database or component configuration repository is required',
    );
  if (!authMiddleware)
    throw new TypeError('BCK01 authentication middleware is required');
  if (!products || !sizes)
    throw new TypeError('Product and pizza size repositories are required');
  if (!impactGuard) throw new TypeError('BCK08 impact guard is required');

  const stock = database ? new PostgresStockRepository(database) : null;
  const configurationProducts = stock
    ? {
        findById: (id) => products.findById(id),
        async findByIdForUpdate(id, tx) {
          const product = await products.findByIdForUpdate(id, tx);
          if (!product) return null;
          const currentStock = await stock.findCurrentByProductIdForUpdate(
            id,
            tx,
          );
          return {
            getId: () => product.getId(),
            isPizzaComponent: () => product.isPizzaComponent(),
            isStockControlled: () => currentStock !== null,
          };
        },
      }
    : products;
  const service = new ComponentSizeConfigurationService({
    repository: persistenceRepository,
    products: configurationProducts,
    sizes,
    unitOfWork: transactionBoundary,
    impact: impactGuard,
  });
  const controller = new ComponentConfigurationController(service);
  const router = Router();
  router.use(
    '/products',
    new ComponentConfigurationRoutes(controller, authMiddleware).setupRoutes(),
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
