import { ComponentConfigurationData } from '../../application/dtos/ComponentConfigurationData.js';
import { ComponentConfigurationUpdateDTO } from '../../application/dtos/ComponentConfigurationUpdateDTO.js';
import { PizzaSizeId, ProductId } from '../../domain/model/values.js';

export class ComponentConfigurationController {
  constructor(service) {
    this.service = service;
  }

  validatePath(req, includeSize = true) {
    const productId = ProductId.create(req.params.productId);
    const sizeId = includeSize
      ? PizzaSizeId.create(req.params.sizeId)
      : undefined;
    return { productId, sizeId };
  }

  async create(req, res, _next) {
    const { productId, sizeId } = this.validatePath(req);
    const result = await this.service.create(
      productId,
      sizeId,
      new ComponentConfigurationData(req.body),
    );
    res
      .location(
        `/api/v1/products/${productId.getValue()}/component-configurations/${sizeId.getValue()}`,
      )
      .status(201)
      .json(result);
  }

  async update(req, res, _next) {
    const { productId, sizeId } = this.validatePath(req);
    const result = await this.service.update(
      productId,
      sizeId,
      new ComponentConfigurationUpdateDTO(req.body),
    );
    res.json(result);
  }

  async consult(req, res, _next) {
    const { productId } = this.validatePath(req, false);
    res.json(await this.service.consult(productId));
  }
}
