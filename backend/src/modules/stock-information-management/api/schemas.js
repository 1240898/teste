import Joi from 'joi';
import { MAX_STOCK_UNITS } from '../domain/model/values.js';

const productId = Joi.string()
  .trim()
  .pattern(/^PROD-\d{5,}$/)
  .max(32);
const page = Joi.number().integer().min(1).default(1);
const pageSize = Joi.number().integer().min(1).max(100).default(20);

export const schemas = {
  productParams: Joi.object({
    productId: productId.required(),
  }).unknown(false),
  startTracking: Joi.object({
    productId: productId.required(),
    initialUnits: Joi.number()
      .integer()
      .min(0)
      .max(MAX_STOCK_UNITS)
      .strict()
      .custom((value, helpers) =>
        Number.isSafeInteger(value) ? value : helpers.error('number.unsafe'),
      ),
  }).unknown(false),
  search: Joi.object({
    productId,
    productName: Joi.string().trim().min(1).max(100),
    isActive: Joi.boolean(),
    historical: Joi.boolean().default(false),
    page,
    pageSize,
  }).unknown(false),
  adjustment: Joi.object({
    direction: Joi.string().valid('INCREASE', 'DECREASE').required(),
    units: Joi.number()
      .integer()
      .positive()
      .max(MAX_STOCK_UNITS)
      .strict()
      .custom((value, helpers) =>
        Number.isSafeInteger(value) ? value : helpers.error('number.unsafe'),
      )
      .required(),
  }).unknown(false),
};
