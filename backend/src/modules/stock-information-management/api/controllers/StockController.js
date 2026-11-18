import { StockAdjustmentDTO } from '../../application/dtos/StockAdjustmentDTO.js';
import { StartStockTrackingDTO } from '../../application/dtos/StartStockTrackingDTO.js';
import { StockSearchDTO } from '../../application/dtos/StockSearchDTO.js';
import { ProductId } from '../../domain/model/values.js';

export class StockController {
  constructor(useCases) {
    this.useCases = useCases;
  }

  async startTracking(req, res) {
    res
      .status(201)
      .json(
        await this.useCases.startTracking(
          new StartStockTrackingDTO(req.validatedBody ?? req.body),
        ),
      );
  }

  async getForProduct(req, res) {
    const { productId } = req.validatedParams ?? req.params;
    res.json(await this.useCases.getForProduct(ProductId.create(productId)));
  }

  async search(req, res) {
    res.json(
      await this.useCases.search(
        new StockSearchDTO(req.validatedQuery ?? req.query),
      ),
    );
  }

  async adjust(req, res) {
    const { productId } = req.validatedParams ?? req.params;
    res
      .status(200)
      .json(
        await this.useCases.adjustStock(
          ProductId.create(productId),
          new StockAdjustmentDTO(req.body),
        ),
      );
  }

  async stopTracking(req, res) {
    const { productId } = req.validatedParams ?? req.params;
    await this.useCases.stopTracking(ProductId.create(productId));
    res.status(204).end();
  }
}
