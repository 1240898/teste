import { Router } from 'express';
import Joi from 'joi';
import { InputError } from '../planning-inputs/domain/InputError.js';
import { planningError } from '../planning-inputs/api/planningError.js';
import { inspectSupplierDocument } from './supplierDocument.js';

// The Procurement component uses Backoffice's current Manager authority and private records API.
// Its public router can be mounted independently of the portal.
export function createProcurementScenarios({ backoffice, confirmToken }) {
  const router = Router();
  const records = '/internal/planning-records/supplier-previews';
  const scoped = Router();
  scoped.use(async (req, res, next) => {
    const auth = req.get('authorization');
    const { actorId } = await backoffice(
      'GET',
      '/internal/planning-access',
      auth,
    );
    if (!actorId || !confirmToken)
      throw new InputError(
        'SCENARIOS_UNAVAILABLE',
        'Supplier preparation is unavailable.',
        503,
      );
    res.locals.actor = actorId;
    next();
  });
  scoped.param('id', (req, _res, next, id) => {
    if (
      Joi.string().guid({ version: 'uuidv4', separator: '-' }).validate(id)
        .error
    )
      throw new InputError(
        'INVALID_PREVIEW_ID',
        'Choose an existing supplier preview.',
        400,
        'previewId',
      );
    next();
  });
  const call = (method, path, body) =>
    backoffice(method, path, 'Bearer ' + confirmToken, body);
  scoped.post('/supplier-scenario-previews', async (req, res) => {
    const { products } = await backoffice(
      'GET',
      '/planning/products/export',
      req.get('authorization'),
    );
    const withoutOffers = inspectSupplierDocument(req.body, products);
    res.status(201).json(
      await call('POST', records, {
        actor: res.locals.actor,
        document: req.body,
        withoutOffers,
      }),
    );
  });
  const lookup = (req, res) =>
    call(
      'GET',
      records +
        '/' +
        encodeURIComponent(req.params.id) +
        '?actor=' +
        encodeURIComponent(res.locals.actor),
    );
  scoped.get('/supplier-scenario-previews/:id', async (req, res) =>
    res.json(await lookup(req, res)),
  );
  scoped.put(
    '/supplier-scenario-previews/:id/confirmation',
    async (req, res) => {
      const preview = await lookup(req, res);
      if (preview.scenario) return res.json(preview.scenario);
      const id = 'SCEN-' + preview.previewId;
      const result = await call(
        'PUT',
        '/internal/planning-records/supplier-scenarios/' +
          id +
          '/versions/1?previewActor=' +
          encodeURIComponent(res.locals.actor),
        preview.document,
      );
      res.json(result);
    },
  );
  scoped.get('/supplier-scenarios', async (_req, res) =>
    res.json(await call('GET', records + '/confirmed')),
  );
  // Limit authentication and error handling to these two public resources.
  router.use('/planning', (req, res, next) => {
    if (!/^\/supplier-(scenario-previews|scenarios)(\/|$)/.test(req.path))
      return next();
    scoped(req, res, next);
  });
  router.use(planningError);
  return { router };
}

export function backofficeClient(baseUrl) {
  return async (method, path, authorization, body) => {
    let response, payload;
    try {
      response = await fetch(baseUrl + path, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          ...(authorization && { Authorization: authorization }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      payload = await response.json();
    } catch {
      throw new InputError(
        'BACKOFFICE_UNAVAILABLE',
        'Planning records are unavailable.',
        503,
      );
    }
    if (!response.ok) {
      const error = payload?.error ?? {};
      const credentialFailure =
        path.startsWith('/internal/planning-records') &&
        [401, 403].includes(response.status);
      if (
        credentialFailure ||
        response.status >= 500 ||
        (response.status === 404 && !error.code)
      )
        throw new InputError(
          'BACKOFFICE_UNAVAILABLE',
          'Planning records are unavailable.',
          503,
        );
      throw new InputError(
        error.code ?? 'ACCESS_DENIED',
        error.message,
        response.status,
        error.field,
        error.reference,
      );
    }
    return payload;
  };
}
