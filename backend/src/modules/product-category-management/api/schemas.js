import Joi from 'joi';

// Shape only: content rules (empty, too long...) are enforced by the CategoryName
// value object so clients receive a specific message.
const body = Joi.object({ name: Joi.string().allow('').required() }).unknown(
  false,
);
export const schemas = { create: body, update: body };
