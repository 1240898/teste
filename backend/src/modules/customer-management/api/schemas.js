import Joi from 'joi';
import { CUSTOMER_ID_PATTERN } from '../domain/model/values.js';
const restriction = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('', null).optional(),
    // Range (1..14) is enforced by the AllergenId value object.
  allergenId: Joi.number().strict().allow(null).optional(),
}).unknown(false);
const body = Joi.object({
  name: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  email: Joi.string().required(),
  dietaryRestrictions: Joi.array().items(restriction).default([]),
  userId: Joi.string().trim().min(1).allow(null).optional(),
}).unknown(false);
export const schemas = {
  create: body,
  update: body,
  id: Joi.string().pattern(new RegExp(CUSTOMER_ID_PATTERN, 'i')).required(),
  search: Joi.object({
    name: Joi.string().allow(''),
    email: Joi.string().allow(''),
    phoneNumber: Joi.string().allow(''),
    userId: Joi.string().allow(''),
  }).unknown(false),
};
