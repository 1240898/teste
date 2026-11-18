import { Router } from 'express';
import { PostgresUnitOfWork } from '../../shared/persistence/postgres/PostgresUnitOfWork.js';
import { StockController } from './api/controllers/StockController.js';
import { StockRoutes } from './api/routes/StockRoutes.js';
import { StockManagementService } from './application/services/StockManagementService.js';
import { ProductModuleProductReader } from './infrastructure/products/ProductModuleProductReader.js';
import { PostgresStockRepository } from './infrastructure/persistence/PostgresStockRepository.js';

export function createStockModule({
  database,
  authMiddleware,
  repository,
  queryRepository,
  productReader,
  unitOfWork,
} = {}) {
  const persistenceRepository =
    repository ??
    (database ? new PostgresStockRepository(database) : undefined);
  const readRepository = queryRepository ?? persistenceRepository;
  const productStatusReader =
    productReader ??
    (database ? new ProductModuleProductReader(database) : undefined);
  const transactionBoundary =
    unitOfWork ?? (database ? new PostgresUnitOfWork(database) : undefined);

  if (
    !persistenceRepository ||
    !readRepository ||
    !productStatusReader ||
    !transactionBoundary
  )
    throw new TypeError(
      'A database or stock repository and adapters are required',
    );
  if (!authMiddleware)
    throw new TypeError('BCK01 authentication middleware is required');

  const service = new StockManagementService(
    persistenceRepository,
    readRepository,
    productStatusReader,
    transactionBoundary,
  );
  const controller = new StockController(service);
  const router = Router();
  new StockRoutes(controller, authMiddleware).register(router);
  const stockConsumption = Object.freeze({
    consumeForOrder: service.consumeForOrder.bind(service),
  });
  const stockProvisioning = Object.freeze({
    initializeForProduct: service.initializeForProduct.bind(service),
    disableForProduct: service.disableForProduct.bind(service),
  });

  return {
    router,
    service,
    stockProvisioning,
    stockConsumption,
    repository: persistenceRepository,
    queryRepository: readRepository,
    productReader: productStatusReader,
    unitOfWork: transactionBoundary,
  };
}

export function register(router, module) {
  if (module) router.use(module.router);
}
