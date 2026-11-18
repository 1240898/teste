import Joi from 'joi';
import { PIZZA_SIZE_ID_PATTERN } from '../domain/model/values.js';

const body = Joi.object({
  name: Joi.string().trim().min(1).max(50).required(),
}).unknown(false);
const updateBody = Joi.object({
  name: Joi.string().trim().min(1).max(50),
  active: Joi.boolean(),
})
  .min(1)
  .unknown(false);

export const schemas = {
  create: body,
  update: updateBody,
  id: Joi.string().pattern(new RegExp(PIZZA_SIZE_ID_PATTERN, 'i')).required(),
  search: Joi.object({
    id: Joi.string().allow(''),
    name: Joi.string().allow(''),
    active: Joi.boolean(),
  }).unknown(false),
};
