import Joi from 'joi';

// Only the ENVELOPE is checked here (400). The JSON content is validated by the
// domain (KitchenLayoutValidator -> 422) so that EVERY issue is reported, and
// the name rules by ConfigurationName.
const content = Joi.object().unknown(true).required();

export const schemas = {
  id: Joi.object({
    id: Joi.string()
      .pattern(/^KCF-\d{5,}$/i)
      .max(32)
      .required(),
  }).unknown(false),
  create: Joi.object({
    name: Joi.string().allow('').max(200).required(),
    content,
  }).unknown(false),
  update: Joi.object({
    name: Joi.string().allow('').max(200).required(),
    content,
    version: Joi.number().integer().min(1).max(2147483647).strict().required(),
  }).unknown(false),
  validate: Joi.object({ content }).unknown(false),
};