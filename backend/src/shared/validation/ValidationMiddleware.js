import { AppError } from '../errors/AppError.js';

export class ValidationMiddleware {
  static validate(schema, source = 'body') {
    return (req, _res, next) => {
      const { value, error } = schema.required().validate(req[source]);
      if (error) throw new AppError('Invalid request body', 400);
      if (source === 'query') req.validatedQuery = value;
      else req[source] = value;
      next();
    };
  }
}
