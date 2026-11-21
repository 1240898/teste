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
  dietaryRestrictions: Joi.array().items(restriction),
  userId: Joi.string().trim().min(1).allow(null).optional(),
  // GDP01: the customer's explicit consent for allergen/dietary data (Art. 9(2)(a)).
  healthDataConsent: Joi.boolean().strict().optional(),
}).unknown(false);
// GDP01: self-service schemas for the authenticated Customer's own record.
const phoneNumber = Joi.string().trim().max(32).required();
export const schemas = {
  create: body.fork('dietaryRestrictions', (field) => field.default([])),
  update: body,
  id: Joi.string().pattern(new RegExp(CUSTOMER_ID_PATTERN, 'i')).required(),
  completeProfile: Joi.object({ phoneNumber }).unknown(false),
  updateProfile: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    phoneNumber,
  }).unknown(false),
  allergens: Joi.object({
    healthDataConsent: Joi.boolean().strict().required(),
    allergenIds: Joi.array()
      .items(Joi.number().strict().integer().min(1).max(14))
      .unique()
      .max(14)
      .default([]),
  }).unknown(false),
  search: Joi.object({
    name: Joi.string().allow(''),
    email: Joi.string().allow(''),
    phoneNumber: Joi.string().allow(''),
    userId: Joi.string().allow(''),
  }).unknown(false),
};