import { Router } from 'express';
import { AppError } from '../../../../shared/errors/AppError.js';
import { catalogueSchemas } from '../schemas.js';

function validateQuery(req, _res, next) {
  const { value, error } = catalogueSchemas.search.validate(req.query);
  if (error) throw new AppError('Invalid request query', 400);
  req.validatedQuery = value;
  next();
}

function validateProductId(req, _res, next) {
  const { error } = catalogueSchemas.productId.validate(req.params);
  if (error) throw new AppError('Invalid request parameters', 400);
  next();
}

// WEB03 (ALN-1, BR 14): the sellable catalogue is public (Table 1: Guest may
// browse it). The answer has no stock quantities and no personal data.
export class CatalogueRoutes {
  constructor(controller) {
    this.controller = controller;
  }

  setupRoutes() {
    const router = Router();
    router.get('/', validateQuery, this.controller.list.bind(this.controller));
    router.get(
      '/:productId',
      validateProductId,
      this.controller.getById.bind(this.controller),
    );
    return router;
  }
}