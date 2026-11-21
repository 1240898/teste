export class CustomerController {
  constructor(service) {
    this.service = service;
  }
  async create(req, res) {
    const customer = await this.service.create(req.body);
    res.location(`/api/v1/customers/${customer.id}`).status(201).json(customer);
  }
  async search(req, res) {
    res.json(await this.service.search(req.query));
  }
  async getById(req, res) {
    try {
      res.json(await this.service.getById(req.params.id, req.user));
    } catch (error) {
      if (error.authorizationOutcome)
        res.locals.authorizationOutcome = error.authorizationOutcome;
      throw error;
    }
  }
  async update(req, res) {
    res.json(await this.service.update(req.params.id, req.body));
  }
  async deactivate(req, res) {
    await this.service.deactivate(req.params.id);
    res.status(204).end();
  }
  async activate(req, res) {
    await this.service.activate(req.params.id);
    res.status(204).end();
  }
  // GDP01: the authenticated Customer's own record.
  async getMine(req, res) {
    res.json(await this.service.getMine(req.user));
  }
  async completeMine(req, res) {
    const customer = await this.service.completeMine(req.user, req.body);
    res.location('/api/v1/customers/me').status(201).json(customer);
  }
  async updateMine(req, res) {
    res.json(await this.service.updateMine(req.user, req.body));
  }
  async updateMyAllergens(req, res) {
    res.json(await this.service.updateMyAllergens(req.user, req.body));
  }
}
