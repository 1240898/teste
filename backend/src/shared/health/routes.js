import { Router } from 'express';
import { version } from '../openapi/spec.js';

const router = Router();

/**
 * GET /api/v1/health
 */
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    version,
    timestamp: new Date().toISOString(),
  });
});

export default router;
