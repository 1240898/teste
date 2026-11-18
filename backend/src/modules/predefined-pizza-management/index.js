import { Router } from 'express';
import { PredefinedPizzaController } from './api/controllers/PredefinedPizzaController.js';
import { PredefinedPizzaRoutes } from './api/routes/PredefinedPizzaRoutes.js';
import { PredefinedPizzaManagementService } from './application/services/PredefinedPizzaManagementService.js';
import { ProductRepository } from '../product-management/infrastructure/persistence/ProductRepository.js';
import { PostgresConfigurationReferenceReader } from './infrastructure/persistence/PostgresConfigurationReferenceReader.js';
import { PostgresUnitOfWork } from '../../shared/persistence/postgres/PostgresUnitOfWork.js';

export function createPredefinedPizzaManagementModule({
  database,
  authMiddleware,
  productRepository,
  referenceReader,
  unitOfWork,
} = {}) {
  const productAggregateRepository =
    productRepository ??
    (database ? new ProductRepository(database) : undefined);
  const configurationReader =
    referenceReader ??
    (database ? new PostgresConfigurationReferenceReader(database) : undefined);
  const transactionBoundary =
    unitOfWork ?? (database ? new PostgresUnitOfWork(database) : undefined);
  if (
    !productAggregateRepository ||
    !configurationReader ||
    !transactionBoundary
  )
    throw new TypeError(
      'A database or predefined pizza repository, reference reader and unit of work are required',
    );
  if (!authMiddleware)
    throw new TypeError('BCK01 authentication middleware is required');

  const service = new PredefinedPizzaManagementService({
    productRepository: productAggregateRepository,
    referenceReader: configurationReader,
    unitOfWork: transactionBoundary,
  });
  const controller = new PredefinedPizzaController(service);
  const router = Router();
  router.use(
    '/predefined-pizzas',
    new PredefinedPizzaRoutes(controller, authMiddleware).setupRoutes(),
  );
  return {
    router,
    service,
    productRepository: productAggregateRepository,
    referenceReader: configurationReader,
    unitOfWork: transactionBoundary,
  };
}

export function register(router, module) {
  if (module) router.use(module.router);
}
