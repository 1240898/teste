import Joi from 'joi';

const amount = Joi.string().strict().min(1).required();
const currency = Joi.string().strict().min(1).required();
const stockUnitsConsumed = Joi.number()
  .integer()
  .min(0)
  .strict()
  .allow(null)
  .required();

export const schemas = {
  create: Joi.object({
    amount,
    currency,
    stockUnitsConsumed,
  }).unknown(false),
  update: Joi.object({
    amount: amount.optional(),
    currency: currency.optional(),
    stockUnitsConsumed: stockUnitsConsumed.optional(),
  })
    .min(1)
    .unknown(false),
};
