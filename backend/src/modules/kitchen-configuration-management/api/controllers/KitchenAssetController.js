export class KitchenAssetController {
  constructor(service) {
    this.service = service;
  }

  async listAssets(_req, res) {
    res.json(await this.service.listAssets());
  }
}