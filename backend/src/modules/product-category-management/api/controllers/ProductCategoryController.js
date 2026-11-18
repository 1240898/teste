import { CreateCategoryDTO } from '../../application/dtos/CreateCategoryDTO.js';
import { UpdateCategoryDTO } from '../../application/dtos/UpdateCategoryDTO.js';

export class ProductCategoryController {
  constructor(categoryService) {
    this.categoryService = categoryService;
  }
  async createCategory(req, res) {
    const category = await this.categoryService.createCategory(
      new CreateCategoryDTO(req.body),
    );
    res
      .location(`/api/v1/categories/${category.id}`)
      .status(201)
      .json(category);
  }
  async updateCategory(req, res) {
    res.json(
      await this.categoryService.updateCategory(
        req.params.id,
        new UpdateCategoryDTO(req.body),
      ),
    );
  }
  async getAllCategories(req, res) {
    res.json(
      await this.categoryService.listCategories({
        name: req.query.name,
        id: req.query.id,
      }),
    );
  }
  async getCategoryById(req, res) {
    res.json(await this.categoryService.getCategoryById(req.params.id));
  }
  async deleteCategory(req, res) {
    await this.categoryService.deleteCategory(req.params.id);
    res.status(204).end();
  }
}
