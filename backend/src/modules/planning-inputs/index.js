import { Router } from 'express';
import Joi from 'joi';
import { InputError } from './domain/InputError.js';
import { serviceAccess } from './api/serviceAccess.js';
import { idsSchema, selectionSchema, validate, safeJson } from './api/schemas.js';
import { SupplierPreviewRecords } from './infrastructure/SupplierPreviewRecords.js';
import { InputViewService } from './application/InputViewService.js';
import { PlanningInputSource } from './infrastructure/PlanningInputSource.js';
import { PostgresInputRecords } from './infrastructure/InputRecords.js';
import { ConfirmedSupplierScenarios } from './infrastructure/ConfirmedSupplierScenarios.js';

const prefix = '/internal/planning';
const bindingSchema = Joi.object({ attemptNo: Joi.number().integer().min(1).required(),
  document: Joi.object({ schemaVersion: Joi.number().valid(1).required() }).unknown(true).required() });
const offersSchema = Joi.object({ id: Joi.string().required(), version: Joi.string().required(),
  type: Joi.string().valid('fixture', 'confirmed'),
  productIds: Joi.array().items(Joi.string().required()).unique().max(500).required() });
const groups = ['products', 'sizes', 'pizza-configurations', 'component-configurations', 'recipes', 'stock', 'incoming-deliveries'];

export function createPlanningInputModule({ database, fixtures, credentials, source, records, viewOptions, demandReader, supplierReader, incomingReader } = {}) {
  const access = serviceAccess(credentials);
  const views = new InputViewService(source ?? new PlanningInputSource({ database, fixtures, demandReader, incomingReader }), viewOptions);
  const snapshots = records ?? new PostgresInputRecords(database);
  const confirmed = supplierReader ?? (database && new ConfirmedSupplierScenarios(database));
  const router = Router();
  router.param('id', (req, _res, next) => {
    validate(Joi.string().guid({ version: 'uuidv4' }), req.params.id); next();
  });
  const send = (res, data) => res.json(safeJson(data));

  // These records are retained inputs only, not public AI05 executions/results.
  router.post(`${prefix}/input-runs`, access('records'), async (req, res) =>
    send(res, await snapshots.claim(validate(selectionSchema, req.body))));
  router.get(`${prefix}/input-runs/:id/inputs`, access('read'), async (req, res) => {
    const result = await snapshots.get(req.params.id);
    if (!result.snapshot) return res.status(409).json({ execution: result.execution,
      error: { status: 409, code: 'INPUTS_NOT_SEALED', message: 'The input run has no sealed snapshot.' } });
    send(res, result);
  });
  router.put(`${prefix}/input-runs/:id/inputs`, access('records'), async (req, res) => {
    const { attemptNo, document } = validate(bindingSchema, req.body);
    validate(selectionSchema, document.selection);
    safeJson(document);
    send(res, await snapshots.bind(req.params.id, attemptNo, document));
  });
  router.post(`${prefix}/read-views`, access('read'), async (req, res) => {
    const view = await views.open(validate(selectionSchema, req.body));
    try { send(res, view); } catch (error) { await views.close(view.viewId); throw error; }
  });
  for (const group of groups)
    router.post(`${prefix}/read-views/:id/${group}`, access('read'), async (req, res) => {
      const { productIds, sizeIds } = validate(idsSchema, req.body);
      send(res, await views.read(req.params.id, group, productIds, sizeIds));
    });
  router.delete(`${prefix}/read-views/:id`, access('read'), async (req, res) => {
    await views.close(req.params.id); res.sendStatus(204);
  });
  router.post(`${prefix}/supplier-offers`, access('read'), async (req, res) => {
    const { id, version, type, productIds } = validate(offersSchema, req.body);
    if (type === 'fixture') return send(res, fixtures.offers({ id, version }, productIds));
    if (!confirmed) throw new InputError('INPUT_SOURCE_UNAVAILABLE', 'Confirmed supplier storage is unavailable.', 503);
    send(res, await confirmed.read({ id, version }, productIds));
  });
  const previews = database && new SupplierPreviewRecords(database);
  if (previews) {
    const path = '/internal/planning-records/supplier-previews';
    const previewBody = Joi.object({
      actor: Joi.string().required(),
      document: Joi.object().required(),
      withoutOffers: Joi.array().required(),
    }).required();
    router.get(path + '/confirmed', access('confirm'), async (_req, res) =>
      send(res, await previews.list()));
    router.post(path, access('confirm'), async (req, res) => {
      const { actor, document, withoutOffers } = validate(previewBody, req.body);
      send(res, await previews.save(actor, document, withoutOffers));
    });
    router.get(path + '/:id', access('confirm'), async (req, res) => {
      const actor = validate(Joi.string().required(), req.query.actor);
      send(res, await previews.read(actor, req.params.id));
    });
  }
  if (confirmed?.confirm) {
    router.put('/internal/planning-records/supplier-scenarios/:scenarioId/versions/:version',
      access('confirm'), async (req, res) => {
        const { scenarioId: id, version } = req.params;
        const checkPreview = req.query.previewActor && previews
          ? tx => previews.checkConfirmation(tx, id.slice('SCEN-'.length), req.query.previewActor, req.body)
          : undefined;
        send(res, await confirmed.confirm({ id, version }, req.body, checkPreview));
      });
  }
  router.use((error, _req, res, _next) => {
    const known = error instanceof InputError;
    const status = known ? error.status : 503;
    res.status(status).json({ error: { status,
      code: known ? error.code : 'INPUT_SOURCE_UNAVAILABLE',
      message: known ? error.message : 'Planning input source is unavailable.',
      ...(known && error.field && { field: error.field }),
      ...(known && error.reference && { reference: error.reference }) } });
  });
  return { router, views, records: snapshots, dispose: () => views.dispose() };
}

export function register(router, module) { if (module) router.use(module.router); }
