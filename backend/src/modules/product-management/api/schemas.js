import Joi from 'joi';

// Shape only: content rules (empty name, id format, price decimals, type
// combinations...) are enforced by the value objects and the Product aggregate so
// that clients receive a specific message. PUT uses the same full-replacement body.
// `isActive` is NOT accepted (changed only through DELETE / PATCH .../activate).
const body = Joi.object({
  name: Joi.string().allow('').required(),
  description: Joi.string().allow('').required(),
  categoryId: Joi.string().required(),
  isSellable: Joi.boolean().strict().required(),
  isPizzaComponent: Joi.boolean().strict().required(),
  acquisitionType: Joi.string().valid('PRODUCED', 'PURCHASED').required(),
  compositionItems: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().pattern(/^PROD-\d{5,}$/i).max(32).required(),
        quantity: Joi.number().integer().min(1).max(2147483647).strict().required(),
      }).unknown(false),
    )
    .required(),
  pizzaComponentTypeId: Joi.string().allow(null).required(),
  allergenIds: Joi.array().items(Joi.number().strict()).max(14).required(),
  pricingMode: Joi.string().allow(null).required(),
  basePrice: Joi.number().strict().allow(null).required(),
}).unknown(false);

const booleanFlag = Joi.string().valid('true', 'false');

export const schemas = {
  create: body,
  update: body,
  // Query strings are validated here (shape) and converted by the service.
  search: Joi.object({
    name: Joi.string().allow('').max(100),
    categoryId: Joi.string().pattern(/^CAT-\d{5,}$/i).max(32),
    isSellable: booleanFlag,
    isPizzaComponent: booleanFlag,
    isActive: booleanFlag,
    acquisitionType: Joi.string().valid('PRODUCED', 'PURCHASED'),
    pizzaComponentTypeId: Joi.string().trim().min(1).max(32),
    excludeAllergenIds: Joi.string().pattern(/^\d{1,2}(,\d{1,2})*$/),
  }).unknown(false),
  id: Joi.object({
    id: Joi.string().pattern(/^PROD-\d{5,}$/i).max(32).required(),
  }).unknown(false),
};
