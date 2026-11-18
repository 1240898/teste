import Joi from 'joi';

const name = Joi.string().trim().min(1);
const assemblyOrder = Joi.number().integer().positive().strict();
const quantity = Joi.number().integer().min(0).strict();
const maxQuantity = quantity.allow(null);

export const schemas = {
  create: Joi.object({
    name: name.required(),
    assemblyOrder: assemblyOrder.required(),
    minQuantity: quantity.required(),
    maxQuantity: maxQuantity.required(),
  }).unknown(false),
  update: Joi.object({
    name,
    assemblyOrder,
    minQuantity: quantity,
    maxQuantity,
  })
    .min(1)
    .unknown(false),
  search: Joi.object({
    id: Joi.string().trim().min(1),
    name,
  }).unknown(false),
  id: Joi.object({ id: Joi.string().trim().min(1).required() }).unknown(false),
};
