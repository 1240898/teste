import Joi from 'joi';

export const catalogueSchemas = {
  search: Joi.object({
    componentName: Joi.string().trim().min(1).max(100),
    componentIds: Joi.string().pattern(/^PROD-\d{5,}(,PROD-\d{5,})*$/i),
    excludeComponentIds: Joi.string().pattern(/^PROD-\d{5,}(,PROD-\d{5,})*$/i),
    excludeAllergenIds: Joi.string().pattern(/^(?:[1-9]|1[0-4])(?:,(?:[1-9]|1[0-4]))*$/),
  }).unknown(false),
  productId: Joi.object({
    productId: Joi.string()
      .pattern(/^PROD-\d{5,}$/i)
      .required(),
  }).unknown(false),
};
