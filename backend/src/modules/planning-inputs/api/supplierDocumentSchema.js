import Joi from 'joi';

const id = Joi.string().trim().max(160);
const units = Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER);
const offer = Joi.object({
  supplierId: id.required(),
  priceEur: Joi.string()
    .max(24)
    .pattern(/^\d+(?:\.\d{1,2})?$/)
    .required(),
  coveredUnits: units.min(1).required(),
  leadTimeDays: units.required(),
  dailyLimit: units,
});
export const supplierDocumentSchema = Joi.object({
  suppliers: Joi.array()
    .items(Joi.object({ id: id.required(), name: Joi.string().max(200) }))
    .unique('id')
    .required(),
  products: Joi.array()
    .items(
      Joi.object({
        productId: id.required(),
        stockUnit: id.required(),
        offers: Joi.array().items(offer).unique('supplierId').required(),
      }),
    )
    .unique('productId')
    .max(500)
    .required(),
});
