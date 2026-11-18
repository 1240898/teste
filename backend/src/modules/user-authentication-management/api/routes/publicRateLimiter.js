import { rateLimit } from 'express-rate-limit';

export function createPublicRateLimiter(options = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...options,
    handler: (_req, res) =>
      res.status(429).json({
        error: {
          message: 'Too many attempts; try again later',
          status: 429,
        },
      }),
  });
}
