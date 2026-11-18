import { ComponentTypeData } from '../../application/dtos/ComponentTypeData.js';
import { ComponentTypeSearchDTO } from '../../application/dtos/ComponentTypeSearchDTO.js';
import { ComponentTypeUpdateDTO } from '../../application/dtos/ComponentTypeUpdateDTO.js';
import { ComponentTypeId } from '../../domain/model/values.js';

export class ComponentTypeController {
  constructor(service) {
    this.service = service;
  }

  async create(req, res, _next) {
    const result = await this.service.create(new ComponentTypeData(req.body));
    res
      .location(`/api/v1/pizza-component-types/${result.id}`)
      .status(201)
      .json(result);
  }

  async getById(req, res, _next) {
    res.json(
      await this.service.getById(
        ComponentTypeId.create((req.validatedParams ?? req.params).id),
      ),
    );
  }

  async search(req, res, _next) {
    res.json(
      await this.service.search(
        new ComponentTypeSearchDTO(req.validatedQuery ?? req.query),
      ),
    );
  }

  async update(req, res, _next) {
    const result = await this.service.update(
      ComponentTypeId.create((req.validatedParams ?? req.params).id),
      new ComponentTypeUpdateDTO(req.body),
    );
    res.json(result);
  }

  async remove(req, res, _next) {
    await this.service.remove(
      ComponentTypeId.create((req.validatedParams ?? req.params).id),
    );
    res.status(204).end();
  }
}
