import { CreateKitchenConfigurationDTO } from '../../application/dtos/CreateKitchenConfigurationDTO.js';
import { UpdateKitchenConfigurationDTO } from '../../application/dtos/UpdateKitchenConfigurationDTO.js';

const params = (req) => req.validatedParams ?? req.params;

export class KitchenConfigurationController {
  constructor(service) {
    this.service = service;
  }

  async listConfigurations(_req, res) {
    res.json(await this.service.listConfigurations());
  }

  async getConfiguration(req, res) {
    res.json(await this.service.getConfiguration(params(req).id));
  }

  async getActiveConfiguration(_req, res) {
    res.json(await this.service.getActiveConfiguration());
  }

  async createConfiguration(req, res) {
    const configuration = await this.service.createConfiguration(
      new CreateKitchenConfigurationDTO(req.body),
      req.user,
    );
    res
      .location(`/api/v1/kitchen-configurations/${configuration.id}`)
      .status(201)
      .json(configuration);
  }

  async updateConfiguration(req, res) {
    res.json(
      await this.service.updateConfiguration(
        params(req).id,
        new UpdateKitchenConfigurationDTO(req.body),
        req.user,
      ),
    );
  }

  async deleteConfiguration(req, res) {
    await this.service.deleteConfiguration(params(req).id);
    res.status(204).end();
  }

  async activateConfiguration(req, res) {
    res.json(
      await this.service.activateConfiguration(params(req).id, req.user),
    );
  }

  async validateContent(req, res) {
    res.json(await this.service.validateContent(req.body.content));
  }
}