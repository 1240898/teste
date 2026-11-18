import express, { Router } from 'express';
import { RoleMiddleware } from '../../../user-authentication-management/api/middlewares/roleMiddleware.js';

/**
 * Mounted under /api/v1/kitchen-assets.
 *   GET /        -> MANAGER (catalogue, to write references)
 *   GET /files/* -> public, read-only static model / texture files (D8: no
 *                   business or personal data; Three.js loaders cannot send
 *                   an Authorization header).
 */
export class KitchenAssetRoutes {
  constructor(controller, authMiddleware, filesDirectory) {
    Object.assign(this, { controller, authMiddleware, filesDirectory });
  }

  setupRoutes() {
    const router = Router();
    router.get(
      '/',
      this.authMiddleware.verifyToken,
      RoleMiddleware.requireRole('MANAGER'),
      this.controller.listAssets.bind(this.controller),
    );
    if (this.filesDirectory)
      router.use(
        '/files',
        express.static(this.filesDirectory, {
          index: false,
          dotfiles: 'deny',
          redirect: false,
          fallthrough: true,
          setHeaders: (res) => {
            // Overrides the API-wide "no-store": files are immutable per path.
            res.set('Cache-Control', 'public, max-age=300');
            res.set('X-Content-Type-Options', 'nosniff');
          },
        }),
      );
    return router;
  }
}