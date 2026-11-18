import { Router } from 'express';
import { PostgresUnitOfWork } from '../../shared/persistence/postgres/PostgresUnitOfWork.js';
import { AuthMiddleware } from '../user-authentication-management/api/middlewares/authMiddleware.js';
import { KitchenAssetController } from './api/controllers/KitchenAssetController.js';
import { KitchenConfigurationController } from './api/controllers/KitchenConfigurationController.js';
import { KitchenAssetRoutes } from './api/routes/KitchenAssetRoutes.js';
import { KitchenConfigurationRoutes } from './api/routes/KitchenConfigurationRoutes.js';
import { KitchenAssetService } from './application/services/KitchenAssetService.js';
import { KitchenConfigurationService } from './application/services/KitchenConfigurationService.js';
import {
  DEFAULT_ASSETS_DIRECTORY,
  LocalKitchenAssetFileStore,
} from './infrastructure/files/LocalKitchenAssetFileStore.js';
import { KitchenAssetCatalogue } from './infrastructure/persistence/KitchenAssetCatalogue.js';
import { KitchenConfigurationRepository } from './infrastructure/persistence/KitchenConfigurationRepository.js';

export const DEFAULT_ASSETS_PUBLIC_URL =
  'http://localhost:8080/api/v1/kitchen-assets/files';

/** KITCHEN_ASSETS_PUBLIC_URL (back end only, never VITE_*), without trailing "/". */
export function loadKitchenAssetsPublicUrl(env = process.env) {
  const value =
    env.KITCHEN_ASSETS_PUBLIC_URL?.trim() || DEFAULT_ASSETS_PUBLIC_URL;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('KITCHEN_ASSETS_PUBLIC_URL must be an http(s) URL');
  return value.replace(/\/+$/, '');
}

/**
 * Composition root of WEB06. Depends on AA01/AA03 only through the
 * AuthMiddleware (or the userService used to build it). Every port can be
 * replaced (tests use in-memory doubles).
 */
export function createKitchenConfigurationModule({
  database,
  authMiddleware,
  userService,
  repository,
  assetCatalogue,
  assetFiles,
  unitOfWork,
  assetsPublicUrl = loadKitchenAssetsPublicUrl(),
  assetsDirectory = DEFAULT_ASSETS_DIRECTORY,
} = {}) {
  const ports = {
    repository:
      repository ??
      (database ? new KitchenConfigurationRepository(database) : undefined),
    assetCatalogue:
      assetCatalogue ??
      (database ? new KitchenAssetCatalogue(database) : undefined),
    unitOfWork:
      unitOfWork ?? (database ? new PostgresUnitOfWork(database) : undefined),
    assetFiles: assetFiles ?? new LocalKitchenAssetFileStore(assetsDirectory),
  };
  for (const [name, port] of Object.entries(ports))
    if (!port) throw new TypeError(`A database or a ${name} is required`);
  const auth =
    authMiddleware ??
    (userService ? new AuthMiddleware(userService) : undefined);
  if (!auth) throw new TypeError('AA01 authentication middleware is required');

  const assetUrl = (asset) =>
    `${assetsPublicUrl}/${asset.path.split('/').map(encodeURIComponent).join('/')}`;
  const configurationService = new KitchenConfigurationService({
    ...ports,
    assetUrl,
  });
  const assetService = new KitchenAssetService({
    assetCatalogue: ports.assetCatalogue,
    assetUrl,
  });

  const router = Router();
  router.use(
    '/kitchen-configurations',
    new KitchenConfigurationRoutes(
      new KitchenConfigurationController(configurationService),
      auth,
    ).setupRoutes(),
  );
  router.use(
    '/kitchen-assets',
    new KitchenAssetRoutes(
      new KitchenAssetController(assetService),
      auth,
      assetsDirectory,
    ).setupRoutes(),
  );
  return { router, configurationService, assetService, ...ports };
}

export function register(router, module) {
  // Production supplies the fully wired module before listening.
  if (module) router.use(module.router);
}