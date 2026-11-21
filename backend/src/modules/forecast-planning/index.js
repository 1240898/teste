import { Router } from 'express';
import Joi from 'joi';
import { RoleMiddleware } from '../user-authentication-management/api/middlewares/roleMiddleware.js';
import { InputError } from '../planning-inputs/domain/InputError.js';
import { ForecastRepository } from './infrastructure/ForecastRepository.js';
import { exportProducts, forecastOptions } from './infrastructure/catalogue.js';

import { planningError } from '../planning-inputs/api/planningError.js';

export function createForecastModule({ database, authMiddleware }) {
  const forecasts = new ForecastRepository(database);
  const router = Router();
  const manager = [
    authMiddleware.verifyToken,
    RoleMiddleware.requireOperation('planning.manage'),
  ];
  router.get('/internal/planning-access', ...manager, (req, res) =>
    res.json({ actorId: req.user.sub }),
  );
  router.get('/planning/forecast-options', ...manager, async (_req, res) =>
    res.json({ products: await forecastOptions(database) }),
  );
  router.get('/planning/products/export', ...manager, async (_req, res) =>
    res.json({ products: await exportProducts(database) }),
  );
  router.get('/planning/forecasts', ...manager, async (_req, res) =>
    res.json({ items: await forecasts.list() }),
  );
  router.get('/planning/forecasts/:id', ...manager, async (req, res) =>
    res.json(await forecasts.get(req.params.id)),
  );
  router.post('/planning/forecasts', ...manager, async (req, res) => {
    const { creationRequestId, ...document } = req.body ?? {};
    if (
      Joi.string()
        .guid({ version: 'uuidv4' })
        .required()
        .validate(creationRequestId).error
    )
      throw new InputError(
        'INVALID_REQUEST_ID',
        'Supply a creation UUID.',
        400,
        'creationRequestId',
      );
    res
      .status(201)
      .json(
        await forecasts.create(
          req.user.sub,
          creationRequestId.toLowerCase(),
          document,
        ),
      );
  });
  router.put('/planning/forecasts/:id', ...manager, async (req, res) => {
    const { version, ...document } = req.body ?? {};
    res.json(await forecasts.change(req.params.id, version, document));
  });
  router.delete('/planning/forecasts/:id', ...manager, async (req, res) => {
    await forecasts.change(req.params.id, req.query.version, null, true);
    res.sendStatus(204);
  });
  router.use(planningError);
  return { router, forecasts };
}
