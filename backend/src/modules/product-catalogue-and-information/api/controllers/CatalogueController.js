import { AppError } from '../../../../shared/errors/AppError.js';
import { ProductId } from '../../../product-management/domain/model/ProductId.js';
import { CatalogueNotFoundError } from '../../application/CatalogueNotFoundError.js';

export class CatalogueController {
  constructor(service) {
    this.service = service;
  }

  async list(req, res, next) {
    try {
      res.json(await this.service.list(req.validatedQuery));
    } catch (error) {
      next(this.toHttpError(error));
    }
  }

  async getById(req, res, next) {
    try {
      const productId = ProductId.create(req.params.productId);
      res.json(await this.service.getById(productId));
    } catch (error) {
      next(this.toHttpError(error));
    }
  }

  toHttpError(error) {
    if (error instanceof CatalogueNotFoundError)
      return new AppError(error.message, 404);
    return error;
  }
}
