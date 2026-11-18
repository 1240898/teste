import { AppError } from '../../../../shared/errors/AppError.js';

export class StockSearchCriteria {
  constructor({
    productId,
    productName,
    isActive,
    historical = false,
    page,
    pageSize,
  }) {
    if (
      productId !== undefined &&
      productId !== null &&
      typeof productId.getValue !== 'function'
    )
      throw new AppError('Invalid ProductId search criterion');
    if (productName !== undefined && typeof productName !== 'string')
      throw new AppError('Invalid product name search criterion');
    if (isActive !== undefined && typeof isActive !== 'boolean')
      throw new AppError('Invalid Product active-state search criterion');
    if (typeof historical !== 'boolean')
      throw new AppError('Invalid historical-period search criterion');
    if (!Number.isInteger(page) || page < 1)
      throw new AppError('Page must be a positive integer');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw new AppError('Page size must be an integer between 1 and 100');
    if (!Number.isSafeInteger((page - 1) * pageSize))
      throw new AppError('Pagination offset exceeds the supported range');
    Object.assign(this, {
      productId,
      productName,
      isActive,
      historical,
      page,
      pageSize,
    });
    Object.freeze(this);
  }
}
