import Joi from 'joi';
import { InputError } from '../../planning-inputs/domain/InputError.js';

const date = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const time = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === value
      ? value
      : helpers.error('any.invalid');
  });
const entry = Joi.object({
  date: date.required(),
  productId: Joi.string().required(),
  sizeId: Joi.string(),
  quantity: Joi.number()
    .integer()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .required(),
});
const schema = Joi.object({
  name: Joi.string().pattern(/\S/).required(),
  startDate: date.required(),
  endDate: date.required(),
  entries: Joi.array().items(entry).required(),
}).required();

export function validateForecast(document, options) {
  const { value, error } = schema.validate(document, { convert: false });
  if (error) {
    const issue = error.details[0];
    throw new InputError(
      'INVALID_FORECAST',
      issue.message,
      422,
      issue.path.join('.'),
    );
  }
  if (value.endDate < value.startDate)
    throw new InputError(
      'INVALID_PERIOD',
      'End date precedes start date.',
      422,
      'endDate',
    );
  const byId = new Map(options.map((product) => [product.productId, product]));
  const seen = new Set();
  for (const [index, line] of value.entries.entries()) {
    const reject = (code, field, message) => {
      throw new InputError(
        code,
        message,
        422,
        'entries.' + index + '.' + field,
      );
    };
    if (line.date < value.startDate || line.date > value.endDate)
      reject(
        'OUTSIDE_PERIOD',
        'date',
        'Choose a date inside the forecast period.',
      );
    const product = byId.get(line.productId);
    if (!product)
      reject(
        'UNKNOWN_PRODUCT',
        'productId',
        'Choose an active sellable product.',
      );
    if (
      product.isPizza
        ? !product.sizes.some((size) => size.id === line.sizeId)
        : line.sizeId !== undefined
    )
      reject(
        'INCOMPATIBLE_SIZE',
        'sizeId',
        'Choose an applicable pizza size or omit size for a standalone product.',
      );
    const key = JSON.stringify([line.date, line.productId, line.sizeId]);
    if (seen.has(key))
      reject(
        'DUPLICATE_ENTRY',
        'productId',
        'This date, product and size already have an entry.',
      );
    seen.add(key);
  }
  return value;
}
