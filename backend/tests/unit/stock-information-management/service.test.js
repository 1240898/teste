import { jest } from '@jest/globals';
import { StockManagementService } from '../../../src/modules/stock-information-management/application/services/StockManagementService.js';
import { StockInformation } from '../../../src/modules/stock-information-management/domain/model/StockInformation.js';
import {
  AbstractStockQuantity,
  ProductId,
  StockId,
} from '../../../src/modules/stock-information-management/domain/model/values.js';

const productId = ProductId.create('PROD-00123');
const startedAt = new Date('2026-11-04T10:00:00Z');
const endedAt = new Date('2026-11-04T11:00:00Z');
const tx = { transaction: true };

function makeStock(units = 0, end = null) {
  return StockInformation.create(
    StockId.create('STOCK-00001'),
    productId,
    AbstractStockQuantity.create(units),
    startedAt,
    end,
  );
}

function createService({
  product = { productId, productName: 'Mozzarella', isActive: true },
  stock = null,
} = {}) {
  const events = [];
  const stockRepository = {
    nextId: jest.fn(async (transaction) => {
      events.push(['nextId', transaction]);
      return 'STOCK-00001';
    }),
    findCurrentByProductIdForUpdate: jest.fn(async (id, transaction) => {
      events.push(['findCurrentStock', id, transaction]);
      return stock;
    }),
    insert: jest.fn(async (aggregate, transaction) => {
      events.push(['insert', aggregate, transaction]);
    }),
    save: jest.fn(async (aggregate, transaction) => {
      events.push(['save', aggregate, transaction]);
    }),
  };
  const summary = {
    stockId: 'STOCK-00001',
    productId: 'PROD-00123',
    productName: 'Mozzarella',
    availableUnits: 4,
    startedAt,
    endedAt: null,
  };
  const stockQueryRepository = {
    findCurrentSummaryByProductId: jest.fn(async () => summary),
    searchPeriods: jest.fn(async () => ({ items: [summary], totalItems: 1 })),
  };
  const productReader = {
    getByIdForUpdate: jest.fn(async () => product),
  };
  const unitOfWork = {
    withTransaction: jest.fn(async (work) => work(tx)),
  };
  return {
    service: new StockManagementService(
      stockRepository,
      stockQueryRepository,
      productReader,
      unitOfWork,
      () => endedAt,
    ),
    stockRepository,
    stockQueryRepository,
    productReader,
    unitOfWork,
    events,
  };
}

describe('BCK09 StockManagementService', () => {
  test('starts a stock tracking period with zero by default', async () => {
    const context = createService();

    const result = await context.service.startTracking({
      productId: 'PROD-00123',
    });

    expect(result).toMatchObject({
      stockId: 'STOCK-00001',
      productId: 'PROD-00123',
      availableUnits: 0,
    });
    const [, aggregate, transaction] = context.events.find(
      ([name]) => name === 'insert',
    );
    expect(aggregate.getStartedAt()).toEqual(endedAt);
    expect(aggregate.getEndedAt()).toBeNull();
    expect(transaction).toBe(tx);
    expect(context.productReader.getByIdForUpdate).toHaveBeenCalledWith(
      productId,
      tx,
    );
  });

  test('starts a new period with the Manager-supplied initial quantity', async () => {
    const context = createService();
    const result = await context.service.startTracking({
      productId: 'PROD-00123',
      initialUnits: 13,
    });
    expect(result.availableUnits).toBe(13);
  });

  test.each([-1, 1.5, '3', null])(
    'rejects invalid initial quantity %j',
    async (initialUnits) => {
      const context = createService();
      await expect(
        context.service.startTracking({
          productId: 'PROD-00123',
          initialUnits,
        }),
      ).rejects.toMatchObject({ status: 400 });
      expect(context.stockRepository.insert).not.toHaveBeenCalled();
    },
  );

  test('rejects starting tracking for a missing Product', async () => {
    const context = createService({ product: null });
    await expect(
      context.service.startTracking({ productId: 'PROD-00123' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(context.stockRepository.insert).not.toHaveBeenCalled();
  });

  test('rejects a second current period while allowing completed periods to remain', async () => {
    const context = createService({ stock: makeStock(9) });
    await expect(
      context.service.startTracking({ productId: 'PROD-00123' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(context.stockRepository.insert).not.toHaveBeenCalled();
  });

  test('stops tracking at any balance and preserves the final quantity', async () => {
    const stock = makeStock(9);
    const context = createService({ stock });
    await context.service.stopTracking('PROD-00123');
    expect(stock.getEndedAt()).toEqual(endedAt);
    expect(stock.getAvailableUnits()).toBe(9);
    expect(context.stockRepository.save).toHaveBeenCalledWith(stock, tx);
  });

  test('adjusts stock for inactive Products for administrative management', async () => {
    const stock = makeStock(5);
    const context = createService({
      stock,
      product: { productId, productName: 'Mozzarella', isActive: false },
    });
    const result = await context.service.adjustStock(productId, {
      direction: 'INCREASE',
      units: 2,
    });
    expect(result.availableUnits).toBe(7);
    expect(context.stockRepository.save).toHaveBeenCalledWith(stock, tx);
  });

  test('does not persist an adjustment that would underflow current stock', async () => {
    const context = createService({ stock: makeStock(2) });
    await expect(
      context.service.adjustStock(productId, {
        direction: 'DECREASE',
        units: 3,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(context.stockRepository.save).not.toHaveBeenCalled();
  });

  test('does not consume stock for inactive Products', async () => {
    const context = createService({
      stock: makeStock(5),
      product: { productId, productName: 'Mozzarella', isActive: false },
    });
    await expect(
      context.service.consumeForOrder('PROD-00123', 1, tx),
    ).rejects.toMatchObject({ status: 409 });
    expect(context.stockRepository.save).not.toHaveBeenCalled();
  });

  test('does not consume stock if the Product has no current tracking period', async () => {
    const context = createService({ stock: null });
    await expect(
      context.service.consumeForOrder('PROD-00123', 1, tx),
    ).resolves.toBe(false);
    expect(context.stockRepository.save).not.toHaveBeenCalled();
  });

  test('consumes current stock in the caller transaction', async () => {
    const stock = makeStock(5);
    const context = createService({ stock });
    await expect(
      context.service.consumeForOrder('PROD-00123', 3, tx),
    ).resolves.toBe(true);
    expect(stock.getAvailableUnits()).toBe(2);
    expect(context.stockRepository.save).toHaveBeenCalledWith(stock, tx);
    expect(context.unitOfWork.withTransaction).not.toHaveBeenCalled();
  });

  test('consults and searches only current periods through read models', async () => {
    const context = createService();
    await expect(
      context.service.getForProduct(productId),
    ).resolves.toMatchObject({
      stockId: 'STOCK-00001',
      productId: 'PROD-00123',
      availableUnits: 4,
    });
    await expect(
      context.service.search({ isActive: false, page: 1, pageSize: 10 }),
    ).resolves.toMatchObject({ totalItems: 1, page: 1 });
    expect(
      context.stockQueryRepository.findCurrentSummaryByProductId,
    ).toHaveBeenCalledWith(productId);
    expect(context.stockQueryRepository.searchPeriods).toHaveBeenCalledWith(
      expect.objectContaining({ historical: false }),
    );
  });
});
