import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { AuthMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/authMiddleware.js';
import { createStockModule } from '../../../src/modules/stock-information-management/index.js';
import { StockInformation } from '../../../src/modules/stock-information-management/domain/model/StockInformation.js';
import {
  AbstractStockQuantity,
  ProductId,
  StockId,
} from '../../../src/modules/stock-information-management/domain/model/values.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { createUser } from '../../helpers/createUser.js';
import {
  MemoryStockQueryRepository,
  MemoryStockRepository,
  MemoryStockUnitOfWork,
} from '../../helpers/MemoryStockRepository.js';

const security = {
  secret: 'stock-management-test-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const passwordHash = '$2b$10$' + 'a'.repeat(53);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('BCK09 HTTP API with BCK01 security and test doubles', () => {
  let app;
  let stockRepository;
  let productStatuses;
  let productDetails;
  let managerToken;
  let customerToken;

  beforeEach(async () => {
    const users = new MemoryUserRepository();
    const userModule = createUserModule({ repository: users, security });
    const manager = createUser({
      name: 'Manager',
      email: 'manager-stock@example.com',
      passwordHash,
      roles: ['MANAGER'],
    });
    const customer = createUser({
      name: 'Customer',
      email: 'customer-stock@example.com',
      passwordHash,
      roles: ['CUSTOMER'],
    });
    await users.save(manager);
    await users.save(customer);
    managerToken = userModule.tokens.generateToken({
      sub: manager.getId().getValue(),
      email: manager.getEmail().getValue(),
      roles: manager.getRoles(),
    });
    customerToken = userModule.tokens.generateToken({
      sub: customer.getId().getValue(),
      email: customer.getEmail().getValue(),
      roles: customer.getRoles(),
    });

    stockRepository = new MemoryStockRepository();
    const productId = 'PROD-00123';
    stockRepository.stocks.set(
      productId,
      StockInformation.create(
        StockId.create('STOCK-00001'),
        ProductId.create(productId),
        AbstractStockQuantity.create(4),
        new Date('2026-11-04T10:00:00Z'),
      ),
    );
    productDetails = new Map([
      [productId, { name: 'Mozzarella', isActive: true }],
    ]);
    productStatuses = new Map([
      [
        productId,
        {
          productId: ProductId.create(productId),
          productName: 'Mozzarella',
          isActive: true,
        },
      ],
    ]);
    const stockModule = createStockModule({
      repository: stockRepository,
      queryRepository: new MemoryStockQueryRepository(
        stockRepository,
        productDetails,
      ),
      productReader: {
        async getByIdForUpdate(id) {
          return productStatuses.get(id.getValue()) ?? null;
        },
      },
      unitOfWork: new MemoryStockUnitOfWork(),
      authMiddleware: new AuthMiddleware(userModule.userService),
    });
    app = createApp({ userModule, stockModule });
  });

  test('allows a Manager to consult, search, and adjust stock', async () => {
    const consulted = await request(app)
      .get('/api/v1/stock/PROD-00123')
      .set(auth(managerToken));
    expect(consulted.status).toBe(200);
    expect(consulted.body).toEqual({
      stockId: 'STOCK-00001',
      productId: 'PROD-00123',
      productName: 'Mozzarella',
      availableUnits: 4,
      startedAt: '2026-11-04T10:00:00.000Z',
      endedAt: null,
    });

    const searched = await request(app)
      .get('/api/v1/stock?productName=mozz&page=1&pageSize=10')
      .set(auth(managerToken));
    expect(searched.status).toBe(200);
    expect(searched.body).toMatchObject({
      items: [{ stockId: 'STOCK-00001', productId: 'PROD-00123' }],
      page: 1,
      pageSize: 10,
      totalItems: 1,
    });

    const defaultSearch = await request(app)
      .get('/api/v1/stock')
      .set(auth(managerToken));
    expect(defaultSearch.status).toBe(200);
    expect(defaultSearch.body).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 1,
    });

    const emptySearch = await request(app)
      .get('/api/v1/stock?productName=nonexistent')
      .set(auth(managerToken));
    expect(emptySearch.status).toBe(200);
    expect(emptySearch.body).toMatchObject({ items: [], totalItems: 0 });

    const adjusted = await request(app)
      .post('/api/v1/stock/PROD-00123/adjustments')
      .set(auth(managerToken))
      .send({ direction: 'DECREASE', units: 3 });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body).toEqual({
      stockId: 'STOCK-00001',
      productId: 'PROD-00123',
      productName: 'Mozzarella',
      direction: 'DECREASE',
      adjustedUnits: 3,
      availableUnits: 1,
    });
  });

  test('requires authentication and the Manager role', async () => {
    expect((await request(app).get('/api/v1/stock')).status).toBe(401);
    expect(
      (await request(app).get('/api/v1/stock').set(auth(customerToken))).status,
    ).toBe(403);
  });

  test('includes inactive stock by default, filters by state, and permits administrative adjustment', async () => {
    productStatuses.get('PROD-00123').isActive = false;
    productDetails.get('PROD-00123').isActive = false;

    const consultation = await request(app)
      .get('/api/v1/stock/PROD-00123')
      .set(auth(managerToken));
    expect(consultation.status).toBe(200);

    const defaultSearch = await request(app)
      .get('/api/v1/stock')
      .set(auth(managerToken));
    expect(defaultSearch.body).toMatchObject({
      items: [{ productId: 'PROD-00123' }],
      totalItems: 1,
    });

    const inactiveSearch = await request(app)
      .get('/api/v1/stock?isActive=false')
      .set(auth(managerToken));
    expect(inactiveSearch.body.totalItems).toBe(1);

    const activeSearch = await request(app)
      .get('/api/v1/stock?isActive=true')
      .set(auth(managerToken));
    expect(activeSearch.body.totalItems).toBe(0);

    const adjustment = await request(app)
      .post('/api/v1/stock/PROD-00123/adjustments')
      .set(auth(managerToken))
      .send({ direction: 'INCREASE', units: 2 });
    expect(adjustment.status).toBe(200);
    expect(adjustment.body.availableUnits).toBe(6);
  });

  test('rejects an invalid Product active-state search filter', async () => {
    const response = await request(app)
      .get('/api/v1/stock?isActive=sometimes')
      .set(auth(managerToken));
    expect(response.status).toBe(400);
  });

  test('validates adjustment and pagination input', async () => {
    const invalidAdjustment = await request(app)
      .post('/api/v1/stock/PROD-00123/adjustments')
      .set(auth(managerToken))
      .send({ direction: 'DECREASE', units: 0 });
    expect(invalidAdjustment.status).toBe(400);

    const invalidDirection = await request(app)
      .post('/api/v1/stock/PROD-00123/adjustments')
      .set(auth(managerToken))
      .send({ direction: 'SET', units: 1 });
    expect(invalidDirection.status).toBe(400);

    const invalidPage = await request(app)
      .get('/api/v1/stock?page=0')
      .set(auth(managerToken));
    expect(invalidPage.status).toBe(400);

    const unsafePageOffset = await request(app)
      .get('/api/v1/stock?page=9007199254740991&pageSize=100')
      .set(auth(managerToken));
    expect(unsafePageOffset.status).toBe(400);

    const invalidSearchFilter = await request(app)
      .get('/api/v1/stock?productName=')
      .set(auth(managerToken));
    expect(invalidSearchFilter.status).toBe(400);

    const invalidHistoricalFilter = await request(app)
      .get('/api/v1/stock?historical=sometimes')
      .set(auth(managerToken));
    expect(invalidHistoricalFilter.status).toBe(400);

    const invalidProductId = await request(app)
      .get('/api/v1/stock/not-a-product-id')
      .set(auth(managerToken));
    expect(invalidProductId.status).toBe(400);
  });

  test('returns 404 for missing Products and missing current stock periods', async () => {
    const missingConsultation = await request(app)
      .get('/api/v1/stock/PROD-99999')
      .set(auth(managerToken));
    expect(missingConsultation.status).toBe(404);

    stockRepository.stocks.delete('PROD-00123');
    const missingStockRecord = await request(app)
      .get('/api/v1/stock/PROD-00123')
      .set(auth(managerToken));
    expect(missingStockRecord.status).toBe(404);

    const missing = await request(app)
      .post('/api/v1/stock/PROD-99999/adjustments')
      .set(auth(managerToken))
      .send({ direction: 'INCREASE', units: 1 });
    expect(missing.status).toBe(404);

    const notTracking = await request(app)
      .post('/api/v1/stock/PROD-00123/adjustments')
      .set(auth(managerToken))
      .send({ direction: 'INCREASE', units: 1 });
    expect(notTracking.status).toBe(404);
  });

  test('rejects underflow and preserves a zero stock record after a normal decrease', async () => {
    const underflow = await request(app)
      .post('/api/v1/stock/PROD-00123/adjustments')
      .set(auth(managerToken))
      .send({ direction: 'DECREASE', units: 5 });
    expect(underflow.status).toBe(409);
    expect(stockRepository.stocks.get('PROD-00123').getAvailableUnits()).toBe(
      4,
    );

    const reachesZero = await request(app)
      .post('/api/v1/stock/PROD-00123/adjustments')
      .set(auth(managerToken))
      .send({ direction: 'DECREASE', units: 4 });
    expect(reachesZero.status).toBe(200);
    expect(reachesZero.body.availableUnits).toBe(0);
    expect(stockRepository.stocks.has('PROD-00123')).toBe(true);
    expect(productStatuses.get('PROD-00123').isActive).toBe(true);
  });

  test('Manager can stop and restart tracking while preserving each completed period', async () => {
    const stopped = await request(app)
      .delete('/api/v1/stock/PROD-00123')
      .set(auth(managerToken));
    expect(stopped.status).toBe(204);
    expect(stockRepository.history.size).toBe(1);
    expect(stockRepository.history.get('STOCK-00001').getAvailableUnits()).toBe(
      4,
    );

    const historicalPeriods = await request(app)
      .get('/api/v1/stock?productId=PROD-00123&historical=true')
      .set(auth(managerToken));
    expect(historicalPeriods.status).toBe(200);
    expect(historicalPeriods.body).toMatchObject({
      totalItems: 1,
      items: [
        {
          stockId: 'STOCK-00001',
          productId: 'PROD-00123',
          availableUnits: 4,
          startedAt: '2026-11-04T10:00:00.000Z',
        },
      ],
    });
    expect(historicalPeriods.body.items[0].endedAt).toEqual(expect.any(String));

    const restarted = await request(app)
      .post('/api/v1/stock')
      .set(auth(managerToken))
      .send({ productId: 'PROD-00123', initialUnits: 6 });
    expect(restarted.status).toBe(201);
    expect(restarted.body).toMatchObject({
      availableUnits: 6,
      productId: 'PROD-00123',
    });
    expect(
      stockRepository.stocks.get('PROD-00123').getId().getValue(),
    ).not.toBe('STOCK-00001');

    const currentPeriods = await request(app)
      .get('/api/v1/stock?productId=PROD-00123&historical=false')
      .set(auth(managerToken));
    expect(currentPeriods.body).toMatchObject({
      totalItems: 1,
      items: [{ productId: 'PROD-00123', availableUnits: 6, endedAt: null }],
    });
  });
});
