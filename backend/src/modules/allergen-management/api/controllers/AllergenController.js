import { RegisterAllergenDTO } from '../../application/dtos/RegisterAllergenDTO.js';
import { UpdateAllergenDTO } from '../../application/dtos/UpdateAllergenDTO.js';

export class AllergenController {
  constructor(allergenService) {
    this.allergenService = allergenService;
  }
  async createAllergen(req, res) {
    const allergen = await this.allergenService.createAllergen(
      new RegisterAllergenDTO(req.body),
    );
    res.location(`/api/v1/allergens/${allergen.id}`).status(201).json(allergen);
  }
  async updateAllergen(req, res) {
    res.json(
      await this.allergenService.updateAllergen(
        req.params.id,
        new UpdateAllergenDTO(req.body),
      ),
    );
  }
  async getAllAllergens(req, res) {
    res.json(
      await this.allergenService.listAllergens({
        name: req.query.name,
        id: req.query.id,
      }),
    );
  }
  async getAllergenById(req, res) {
    res.json(await this.allergenService.getAllergenById(req.params.id));
  }
  async deleteAllergen(req, res) {
    await this.allergenService.deleteAllergen(req.params.id);
    res.status(204).end();
  }
}