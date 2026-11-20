export class SecurityAuditController {
  constructor(service) {
    this.service = service;
  }

  async search(req, res) {
    res.json(await this.service.search(req.validatedQuery));
  }
}
