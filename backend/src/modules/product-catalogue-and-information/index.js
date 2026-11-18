import { Router } from 'express';
import { CatalogueController } from './api/controllers/CatalogueController.js';
import { CatalogueRoutes } from './api/routes/CatalogueRoutes.js';
import { CatalogueService } from './application/CatalogueService.js';
import { PostgresCatalogueReader } from './infrastructure/PostgresCatalogueReader.js';

// WEB03 (ALN-1): public reads, so no authentication middleware is needed.
export function createCatalogueModule({ database, reader } = {}) {
  const catalogueReader =
    reader ?? (database ? new PostgresCatalogueReader(database) : undefined);
  if (!catalogueReader)
    throw new TypeError('A database or ICatalogueReader is required');

  const service = new CatalogueService({ reader: catalogueReader });
  const controller = new CatalogueController(service);
  const router = Router();
  router.use('/catalogue', new CatalogueRoutes(controller).setupRoutes());
  return { router, service, reader: catalogueReader };
}

export function register(router, module) {
  if (module) router.use(module.router);
}