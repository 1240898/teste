import { StockAdjustmentResultDTO } from '../dtos/StockAdjustmentResultDTO.js';
import { StockResponseDTO } from '../dtos/StockResponseDTO.js';
import { StockSearchResultDTO } from '../dtos/StockSearchResultDTO.js';

function valueOf(value) {
  return typeof value?.getValue === 'function' ? value.getValue() : value;
}

export class StockResponseMapper {
  static toStockResponse(summary) {
    return new StockResponseDTO({
      stockId: valueOf(summary.stockId),
      productId: valueOf(summary.productId),
      productName: summary.productName,
      availableUnits: summary.availableUnits,
      startedAt: summary.startedAt?.toISOString(),
      endedAt: summary.endedAt?.toISOString() ?? null,
    });
  }

  static toSearchResult(page, query) {
    return new StockSearchResultDTO({
      items: page.items.map((item) => this.toStockResponse(item)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems: page.totalItems,
    });
  }

  static toAdjustmentResult(stock, direction, units, productName) {
    return new StockAdjustmentResultDTO({
      stockId: stock.getId().getValue(),
      productId: stock.getProductId().getValue(),
      productName,
      direction,
      adjustedUnits: units,
      availableUnits: stock.getAvailableUnits(),
    });
  }
}
