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
    res.json(await this.service.getById(req.params.id));
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
}
