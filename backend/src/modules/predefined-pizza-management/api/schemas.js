import Joi from 'joi';

const productId = Joi.string().pattern(/^PROD-[0-9]{5,}$/);
const componentIds = Joi.array()
  .items(productId.required())
  .min(1)
  .unique()
  .required();

export const schemas = {
  create: Joi.object({
    productId: productId.required(),
    componentIds,
  }).unknown(false),
  replaceConfiguration: Joi.object({ componentIds }).unknown(false),
  id: Joi.object({
    productId: Joi.string()
      .pattern(/^PROD-[0-9]{5,}$/)
      .required(),
  }).unknown(false),
};
