export class PizzaSizeController {
  constructor(service) {
    this.service = service;
  }
  async create(req, res) {
    const pizzaSize = await this.service.create(req.body);
    res
      .location(`/api/v1/pizza-sizes/${pizzaSize.id}`)
      .status(201)
      .json(pizzaSize);
  }
  async search(req, res) {
    res.json(await this.service.search(req.validatedQuery));
  }
  async getById(req, res) {
    res.json(await this.service.getById(req.params.id));
  }
  async update(req, res) {
    res.json(await this.service.update(req.params.id, req.body));
  }
  async delete(req, res) {
    await this.service.delete(req.params.id);
    res.status(204).end();
  }
}
