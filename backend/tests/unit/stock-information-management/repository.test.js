import { jest } from '@jest/globals';
import { PostgresStockRepository } from '../../../src/modules/stock-information-management/infrastructure/persistence/PostgresStockRepository.js';
import {
  AbstractStockQuantity,
  ProductId,
  StockId,
} from '../../../src/modules/stock-information-management/domain/model/values.js';
import { StockInformation } from '../../../src/modules/stock-information-management/domain/model/StockInformation.js';
import { ProductModuleProductReader } from '../../../src/modules/stock-information-management/infrastructure/products/ProductModuleProductReader.js';

const start = new Date('2026-11-04T10:00:00.000Z');
const end = new Date('2026-11-04T11:00:00.000Z');
const stock = (endedAt = null) =>
  StockInformation.create(
    StockId.create('STOCK-00001'),
    ProductId.create('PROD-00123'),
    AbstractStockQuantity.create(7),
    start,
    endedAt,
  );

describe('PostgresStockRepository', () => {
  test('generates a business StockId from the PostgreSQL sequence', async () => {
    const tx = {
      query: jest.fn().mockResolvedValue({ rows: [{ value: '1' }] }),
    };
    const repository = new PostgresStockRepository({});
    await expect(repository.nextId(tx)).resolves.toBe('STOCK-00001');
  });

  test('loads a current period under row lock and maps period dates', async () => {
    const tx = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            stock_code: 'STOCK-00001',
            product_id: 'PROD-00123',
            available_units: 7,
            started_at: start,
            ended_at: null,
          },
        ],
      }),
    };
    const repository = new PostgresStockRepository({});
    const result = await repository.findCurrentByProductIdForUpdate(
      ProductId.create('PROD-00123'),
      tx,
    );
    expect(result).toBeInstanceOf(StockInformation);
    expect(result.getStartedAt()).toEqual(start);
    expect(result.getEndedAt()).toBeNull();
    expect(tx.query.mock.calls[0][0]).toContain('ended_at IS NULL');
    expect(tx.query.mock.calls[0][0]).toContain('FOR UPDATE');
  });

  test('queries only current stock for consultation and search', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              stock_code: 'STOCK-00001',
              product_id: 'PROD-00123',
              product_name: 'Mozzarella',
              available_units: 0,
              started_at: start,
              ended_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ total_items: '1' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              stock_code: 'STOCK-00001',
              product_id: 'PROD-00123',
              product_name: 'Mozzarella',
              available_units: 0,
              started_at: start,
              ended_at: null,
            },
          ],
        }),
    };
    const repository = new PostgresStockRepository(database);
    const summary = await repository.findCurrentSummaryByProductId(
      ProductId.create('PROD-00123'),
    );
    expect(summary.availableUnits).toBe(0);
    expect(database.query.mock.calls[0][0]).toContain('s.ended_at IS NULL');
    expect(database.query.mock.calls[0][0]).not.toContain(
      'is_stock_controlled',
    );

    const result = await repository.searchPeriods({
      productId: ProductId.create('PROD-00123'),
      productName: 'mozz%',
      isActive: false,
      page: 2,
      pageSize: 10,
    });
    expect(result.totalItems).toBe(1);
    expect(database.query.mock.calls[1][0]).toContain('s.ended_at IS NULL');
    expect(database.query.mock.calls[1][0]).toContain('p.is_active = $3');
    expect(database.query.mock.calls[1][0]).not.toContain(
      'is_stock_controlled',
    );
    expect(database.query.mock.calls[2][1]).toEqual([
      'PROD-00123',
      '%mozz%%',
      false,
      10,
      10,
    ]);
  });

  test('searches only historical periods when requested', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total_items: '1' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              stock_code: 'STOCK-00001',
              product_id: 'PROD-00123',
              product_name: 'Mozzarella',
              available_units: 7,
              started_at: start,
              ended_at: end,
            },
          ],
        }),
    };
    const result = await new PostgresStockRepository(database).searchPeriods({
      productId: ProductId.create('PROD-00123'),
      historical: true,
      page: 1,
      pageSize: 20,
    });
    expect(database.query.mock.calls[0][0]).toContain('s.ended_at IS NOT NULL');
    expect(result.items[0].startedAt).toEqual(start);
    expect(result.items[0].endedAt).toEqual(end);
  });

  test('inserts a period with started_at and no ended_at', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new PostgresStockRepository({});
    await repository.insert(stock(), tx);
    expect(tx.query.mock.calls[0][0]).toContain('started_at, ended_at');
    expect(tx.query.mock.calls[0][1]).toEqual([
      expect.any(String),
      'STOCK-00001',
      'PROD-00123',
      7,
      start,
    ]);
  });

  test('ends a period by persisting ended_at and the unchanged final quantity', async () => {
    const tx = {
      query: jest
        .fn()
        .mockResolvedValue({ rows: [{ product_id: 'PROD-00123' }] }),
    };
    const repository = new PostgresStockRepository({});
    const aggregate = stock();
    aggregate.endTracking(end);
    await repository.save(aggregate, tx);
    expect(tx.query.mock.calls[0][0]).toContain(
      'SET available_units = $2, ended_at = $3',
    );
    expect(tx.query.mock.calls[0][1]).toEqual([
      'PROD-00123',
      7,
      end,
      'STOCK-00001',
    ]);
  });

  test('maps a duplicate current period to conflict', async () => {
    const tx = {
      query: jest.fn().mockRejectedValue({
        code: '23505',
        constraint: 'stock_information_one_current_per_product_key',
      }),
    };
    await expect(
      new PostgresStockRepository({}).insert(stock(), tx),
    ).rejects.toMatchObject({ status: 409 });
  });

  test('reads Product identity and active state without a stock-control flag', async () => {
    const tx = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            product_id: 'PROD-00123',
            product_name: 'Mozzarella',
            is_active: false,
          },
        ],
      }),
    };
    const reader = new ProductModuleProductReader({});
    const product = await reader.getByIdForUpdate(
      ProductId.create('PROD-00123'),
      tx,
    );
    expect(product.productId.getValue()).toBe('PROD-00123');
    expect(product.productName).toBe('Mozzarella');
    expect(product.isActive).toBe(false);
    expect(tx.query.mock.calls[0][0]).not.toContain('is_stock_controlled');
    expect(tx.query.mock.calls[0][0]).toContain('FOR UPDATE');
  });
});
