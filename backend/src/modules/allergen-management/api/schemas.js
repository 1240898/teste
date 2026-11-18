import Joi from 'joi';

// Shape only: content rules (empty name, id outside 1..14...) are enforced by the
// AllergenId / AllergenName value objects so clients receive a specific message.
const name = Joi.string().allow('').required();
export const schemas = {
  register: Joi.object({ id: Joi.number().strict().required(), name }).unknown(
    false,
  ),
  update: Joi.object({ name }).unknown(false),
};