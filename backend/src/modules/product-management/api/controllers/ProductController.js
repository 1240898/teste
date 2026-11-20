import { CreateProductDTO } from '../../application/dtos/CreateProductDTO.js';
import { ProductFilterDTO } from '../../application/dtos/ProductFilterDTO.js';
import { UpdateProductDTO } from '../../application/dtos/UpdateProductDTO.js';

const params = (req) => req.validatedParams ?? req.params;
const STAFF_ROLES = new Set(['MANAGER', 'EMPLOYEE']);
const hasStaffProductView = (req) =>
  req.user?.roles?.some((role) => STAFF_ROLES.has(role)) ?? false;

export class ProductController {
  constructor(productService) {
    this.productService = productService;
  }

  async createProduct(req, res) {
    const product = await this.productService.createProduct(
      new CreateProductDTO(req.body),
    );
    res.location(`/api/v1/products/${product.id}`).status(201).json(product);
  }

  async updateProduct(req, res) {
    res.json(
      await this.productService.updateProduct(
        params(req).id,
        new UpdateProductDTO(req.body),
      ),
    );
  }

  async listProducts(req, res) {
    const filter = new ProductFilterDTO(req.validatedQuery ?? req.query);
    res.json(
      hasStaffProductView(req)
        ? await this.productService.listProducts(filter)
        : await this.productService.listPublicProducts(filter),
    );
  }

  async getProductById(req, res) {
    res.json(
      hasStaffProductView(req)
        ? await this.productService.getProductById(params(req).id)
        : await this.productService.getPublicProductById(params(req).id),
    );
  }

  async deactivateProduct(req, res) {
    await this.productService.deactivateProduct(params(req).id);
    res.status(204).end();
  }

  async activateProduct(req, res) {
    res.json(await this.productService.activateProduct(params(req).id));
  }
}
