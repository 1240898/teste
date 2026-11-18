import { CreatePredefinedPizzaDTO } from '../../application/dtos/CreatePredefinedPizzaDTO.js';
import { ReplacePizzaConfigurationDTO } from '../../application/dtos/ReplacePizzaConfigurationDTO.js';

export class PredefinedPizzaController {
  constructor(service) {
    this.service = service;
  }

  async create(req, res) {
    const result = await this.service.create(
      new CreatePredefinedPizzaDTO(req.body),
    );
    res
      .location(`/api/v1/predefined-pizzas/${result.id}`)
      .status(201)
      .json(result);
  }

  async list(_req, res) {
    res.json(await this.service.list());
  }

  async getById(req, res) {
    res.json(await this.service.getById(req.validatedParams.productId));
  }

  async replaceConfiguration(req, res) {
    const result = await this.service.replaceConfiguration(
      req.validatedParams.productId,
      new ReplacePizzaConfigurationDTO(req.body),
    );
    res.json(result);
  }
}
