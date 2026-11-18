import { AppError } from '../../../../shared/errors/AppError.js';
import { StockInformation } from '../../domain/model/StockInformation.js';
import { ProductId, StockId } from '../../domain/model/values.js';
import { StartStockTrackingDTO } from '../dtos/StartStockTrackingDTO.js';
import { StockAdjustmentDTO } from '../dtos/StockAdjustmentDTO.js';
import { StockSearchDTO } from '../dtos/StockSearchDTO.js';
import { StockResponseMapper } from '../mapping/StockResponseMapper.js';
import { StockSearchCriteria } from '../queries/StockSearchCriteria.js';

export class StockManagementService {
  constructor(
    stockRepository,
    stockQueryRepository,
    productReader,
    unitOfWork,
    clock = () => new Date(),
  ) {
    Object.assign(this, {
      stockRepository,
      stockQueryRepository,
      productReader,
      unitOfWork,
      clock,
    });
  }

  async startTracking(request) {
    const dto =
      request instanceof StartStockTrackingDTO
        ? request
        : new StartStockTrackingDTO(request);
    const id = this.toProductId(dto.productId);
    return this.unitOfWork.withTransaction(async (tx) => {
      const { product, stock } = await this.startTrackingInTransaction(
        id,
        dto.initialUnits === undefined ? 0 : dto.initialUnits,
        tx,
      );
      return StockResponseMapper.toStockResponse({
        stockId: stock.getId(),
        productId: id,
        productName: product.productName,
        availableUnits: stock.getAvailableUnits(),
        startedAt: stock.getStartedAt(),
        endedAt: stock.getEndedAt(),
      });
    });
  }

  async getForProduct(productId) {
    const id = this.toProductId(productId);
    const summary =
      await this.stockQueryRepository.findCurrentSummaryByProductId(id);
    if (!summary)
      throw new AppError('Current stock information not found', 404);
    return StockResponseMapper.toStockResponse(summary);
  }

  async search(query) {
    const dto =
      query instanceof StockSearchDTO ? query : new StockSearchDTO(query);
    const criteria = new StockSearchCriteria({
      productId:
        dto.productId === undefined || dto.productId === ''
          ? undefined
          : this.toProductId(dto.productId),
      productName: dto.productName,
      isActive: dto.isActive,
      historical: dto.historical,
      page: dto.page,
      pageSize: dto.pageSize,
    });
    const page = await this.stockQueryRepository.searchPeriods(criteria);
    return StockResponseMapper.toSearchResult(page, dto);
  }

  async adjustStock(productId, request) {
    const id = this.toProductId(productId);
    const dto =
      request instanceof StockAdjustmentDTO
        ? request
        : new StockAdjustmentDTO(request);
    return this.unitOfWork.withTransaction(async (tx) => {
      const product = await this.requireProduct(id, tx);
      const stock = await this.stockRepository.findCurrentByProductIdForUpdate(
        id,
        tx,
      );
      if (!stock)
        throw new AppError('Current stock information not found', 404);

      if (dto.direction === 'INCREASE') stock.increase(dto.units);
      else stock.decrease(dto.units);

      await this.stockRepository.save(stock, tx);
      return StockResponseMapper.toAdjustmentResult(
        stock,
        dto.direction,
        dto.units,
        product.productName,
      );
    });
  }

  async stopTracking(productId) {
    const id = this.toProductId(productId);
    return this.unitOfWork.withTransaction(async (tx) => {
      await this.stopTrackingInTransaction(id, tx);
    });
  }

  // Compatibility boundary for the currently integrated BCK05 product service.
  // The public stock API owns the same lifecycle through start/stopTracking.
  async initializeForProduct(productId, tx, initialUnits = 0) {
    await this.startTrackingInTransaction(productId, initialUnits, tx);
  }

  async disableForProduct(productId, tx) {
    await this.stopTrackingInTransaction(productId, tx);
  }

  async startTrackingInTransaction(productId, initialUnits, tx) {
    const id = this.toProductId(productId);
    const product = await this.requireProduct(id, tx);
    if (await this.stockRepository.findCurrentByProductIdForUpdate(id, tx))
      throw new AppError('Product already has current stock tracking', 409);
    const stock = StockInformation.startTracking(
      StockId.create(await this.stockRepository.nextId(tx)),
      id,
      initialUnits,
      this.clock(),
    );
    await this.stockRepository.insert(stock, tx);
    return { product, stock };
  }

  async stopTrackingInTransaction(productId, tx) {
    const id = this.toProductId(productId);
    await this.requireProduct(id, tx);
    const stock = await this.stockRepository.findCurrentByProductIdForUpdate(
      id,
      tx,
    );
    if (!stock) throw new AppError('Current stock information not found', 404);
    stock.endTracking(this.clock());
    await this.stockRepository.save(stock, tx);
  }

  async consumeForOrder(productId, units, tx) {
    const id = this.toProductId(productId);
    const adjustment = new StockAdjustmentDTO({ direction: 'DECREASE', units });
    const product = await this.productReader.getByIdForUpdate(id, tx);
    if (!product) throw new AppError('Product not found', 404);
    if (product.isActive !== true)
      throw new AppError('Inactive products cannot be used in new sales', 409);

    const stock = await this.stockRepository.findCurrentByProductIdForUpdate(
      id,
      tx,
    );
    if (!stock) return false;
    stock.decrease(adjustment.units);
    await this.stockRepository.save(stock, tx);
    return true;
  }

  toProductId(productId) {
    return productId instanceof ProductId
      ? productId
      : ProductId.create(productId);
  }

  async requireProduct(productId, tx) {
    const product = await this.productReader.getByIdForUpdate(productId, tx);
    if (!product) throw new AppError('Product not found', 404);
    return product;
  }
}
