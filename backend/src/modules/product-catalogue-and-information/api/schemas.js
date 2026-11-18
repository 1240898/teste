import Joi from 'joi';

export const catalogueSchemas = {
  search: Joi.object({
    componentName: Joi.string().trim().min(1).max(100),
  }).unknown(false),
  productId: Joi.object({
    productId: Joi.string()
      .pattern(/^PROD-\d{5,}$/i)
      .required(),
  }).unknown(false),
};
