import Joi from 'joi';
import { InputError } from '../domain/InputError.js';

const id = Joi.string().min(1).max(160);
const uuid = Joi.string().guid({ version: 'uuidv4' });
const saved = Joi.object({ type: Joi.string().valid('saved').required(), id: id.required(), version: id.required() });
const source = Joi.alternatives().try(saved, Joi.object({ type: Joi.string().valid('current').required() }));
const demand = Joi.object({ type: Joi.string().valid('fixture', 'order', 'forecast').required(),
  id: id.required(), version: id.when('type', { is: 'order', then: Joi.optional(), otherwise: Joi.required() }) });
export const selectionSchema = Joi.object({
  executionId: uuid.required(), scenarioId: id.required(),
  calculation: Joi.string().valid('BOM', 'REQUIREMENTS_PLANNING').required(),
  mode: Joi.string().valid('current', 'historicalReplay').required(),
  demand: demand.required(), catalogue: source.required(), stock: source.required(),
  preparationFixture: Joi.object({ id: id.required(), version: id.required() }),
  receipts: source.when('calculation', { is: 'REQUIREMENTS_PLANNING', otherwise: Joi.forbidden() }),
  supplierScenario: Joi.object({ id: id.required(), version: id.required(), type: Joi.string().valid('fixture', 'confirmed') })
    .when('calculation', { is: 'REQUIREMENTS_PLANNING', then: Joi.required(), otherwise: Joi.forbidden() }),
  referenceDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
    .when('calculation', { is: 'REQUIREMENTS_PLANNING', then: Joi.required(), otherwise: Joi.forbidden() }),
  replayedFrom: uuid.when('mode', { is: 'historicalReplay', then: Joi.required(), otherwise: Joi.forbidden() }),
}).custom((selection, helpers) => {
  // Simulated stock alone never grants a historical catalogue exception.
  if (selection.mode === 'current' && selection.demand.type !== 'fixture' && selection.catalogue.type !== 'current')
    return helpers.error('any.custom');
  return selection;
});
export const idsSchema = Joi.object({ productIds: Joi.array().items(id).unique().max(500).required(),
  sizeIds: Joi.array().items(id).unique().max(50).default([]) });

export function validate(schema, input) {
  const { value, error } = schema.validate(input, { convert: false, abortEarly: true });
  if (error) throw new InputError('INVALID_REQUEST', 'Invalid planning request.', 400,
    error.details[0].path.join('.'));
  return value;
}

// Every response integer must survive JavaScript/JSON unchanged, including pg bigint values.
export function safeJson(value) {
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))))
    throw new InputError('JSON_INTEGER_OUT_OF_RANGE', 'Source contains a number outside the safe JSON range.', 422);
  if (Array.isArray(value)) value.forEach(safeJson);
  else if (value && typeof value === 'object') Object.values(value).forEach(safeJson);
  return value;
}
