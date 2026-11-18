import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { AuthMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/authMiddleware.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createStockModule } from '../../../src/modules/stock-information-management/index.js';
import { StockInformation } from '../../../src/modules/stock-information-management/domain/model/StockInformation.js';
import {
  AbstractStockQuantity,
  ProductId,
  StockId,
} from '../../../src/modules/stock-information-management/domain/model/values.js';
import { createCatalogueModule } from '../../../src/modules/product-catalogue-and-information/index.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { createUser } from '../../helpers/createUser.js';
import {
  MemoryStockQueryRepository,
  MemoryStockRepository,
  MemoryStockUnitOfWork,
} from '../../helpers/MemoryStockRepository.js';
import { facts } from '../../helpers/catalogueFixtures.js';

// WEB03 (usWEB03.md 4.1): the back end grants exactly the access of the
// section matrix (Table 1), independently of what the SPA shows (AC 4, AC 7).

const security = {
  secret: 'web03-permission-matrix-secret-at-least-32-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const passwordHash = '$2b$10$' + 'a'.repeat(53);
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const PRODUCT = 'PROD-00123';

let app;
let users;
let userTokens;
let stockRepository;
let tokens;
let ids;
let targetId;

async function addUser(key, roles) {
  const user = createUser({
    name: key,
    email: `${key.toLowerCase().replace(/[^a-z]/g, '-')}@web03.example.com`,
    passwordHash,
    roles,
  });
  await users.save(user);
  ids[key] = user.getId().getValue();
  return userTokens.generateToken({
    sub: ids[key],
    email: user.getEmail().getValue(),
    roles: user.getRoles(),
  });
}
beforeEach(async () => {
  users = new MemoryUserRepository();
  const userModule = createUserModule({ repository: users, security });
  userTokens = userModule.tokens;
  ids = {};
  tokens = {
    CUSTOMER: await addUser('CUSTOMER', ['CUSTOMER']),
    EMPLOYEE: await addUser('EMPLOYEE', ['EMPLOYEE']),
    MANAGER: await addUser('MANAGER', ['MANAGER']),
    ADMINISTRATOR: await addUser('ADMINISTRATOR', ['ADMINISTRATOR']),
    'ADMINISTRATOR+MANAGER': await addUser('ADMINISTRATOR+MANAGER', [
      'ADMINISTRATOR',
      'MANAGER',
    ]),
  };
  await addUser('TARGET', ['CUSTOMER']);
  targetId = ids.TARGET;

  stockRepository = new MemoryStockRepository();
  stockRepository.stocks.set(
    PRODUCT,
    StockInformation.create(
      StockId.create('STOCK-00001'),
      ProductId.create(PRODUCT),
      AbstractStockQuantity.create(4),
      new Date('2026-11-04T10:00:00Z'),
    ),
  );
  const authMiddleware = new AuthMiddleware(userModule.userService);
  const stockModule = createStockModule({
    repository: stockRepository,
    queryRepository: new MemoryStockQueryRepository(
      stockRepository,
      new Map([[PRODUCT, { name: 'Mozzarella', isActive: true }]]),
    ),
    productReader: {
      async getByIdForUpdate(id) {
        return id.getValue() === PRODUCT
          ? { productId: id, productName: 'Mozzarella', isActive: true }
          : null;
      },
    },
    unitOfWork: new MemoryStockUnitOfWork(),
    authMiddleware,
  });
  const empty = facts({ roots: [], products: [] });
  const catalogueModule = createCatalogueModule({
    reader: { loadSellable: async () => empty, loadFor: async () => empty },
  });
  app = createApp({ userModule, stockModule, catalogueModule });
});

const send = (method, path, token, body) => {
  const call = request(app)[method](`/api/v1${path}`);
  if (token) call.set(auth(token));
  return body === undefined ? call : call.send(body);
};

// Representative endpoint per section of the matrix (role -> expected status).
const MATRIX = [
  ['catalogue', 'get', '/catalogue', undefined, 200, 200, 200, 200, 200, 200],
  ['stock (read)', 'get', '/stock', undefined, 401, 403, 403, 200, 403, 200],
  [
    'stock (adjust)',
    'post',
    `/stock/${PRODUCT}/adjustments`,
    { direction: 'INCREASE', units: 1 },
    401,
    403,
    403,
    200,
    403,
    200,
  ],
  ['users', 'get', '/users', undefined, 401, 403, 403, 403, 200, 200],
];
const COLUMNS = [
  null,
  'CUSTOMER',
  'EMPLOYEE',
  'MANAGER',
  'ADMINISTRATOR',
  'ADMINISTRATOR+MANAGER',
];

describe('WEB03 back-end permission matrix', () => {
  test.each(MATRIX)(
    'IT01: %s follows Table 1 for Guest, Customer, Staff, Manager, Administrator and Administrator+Manager',
    async (_name, method, path, body, ...expected) => {
      for (const [index, role] of COLUMNS.entries()) {
        const response = await send(
          method,
          path,
          role ? tokens[role] : null,
          body,
        );
        expect([role ?? 'GUEST', response.status]).toEqual([
          role ?? 'GUEST',
          expected[index],
        ]);
      }
    },
  );

  test('IT02: a Manager whose role was removed after login is refused on the next operation; stock unchanged', async () => {
    users.users.get(ids.MANAGER).roles = ['CUSTOMER'];
    const refused = await send(
      'post',
      `/stock/${PRODUCT}/adjustments`,
      tokens.MANAGER,
      { direction: 'DECREASE', units: 3 },
    );
    expect(refused.status).toBe(403);
    expect(refused.body.error.message).toBe(
      'Forbidden: insufficient permissions',
    );
    const stock = await send(
      'get',
      `/stock/${PRODUCT}`,
      tokens['ADMINISTRATOR+MANAGER'],
    );
    expect(stock.body.availableUnits).toBe(4);
  });

  test('IT03: a deactivated account is refused with the same token', async () => {
    users.users.get(ids.MANAGER).active = false;
    const refused = await send('get', '/stock', tokens.MANAGER);
    expect(refused.status).toBe(403);
    expect(refused.body.error.message).toBe('Account is not active');
  });

  test.each([
    ['list', 'get', () => '/users', undefined, 200],
    ['detail', 'get', () => `/users/${targetId}`, undefined, 200],
    [
      'roles',
      'patch',
      () => `/users/${targetId}/roles`,
      { roles: ['CUSTOMER', 'EMPLOYEE'] },
      200,
    ],
    ['deactivate', 'delete', () => `/users/${targetId}`, undefined, 204],
  ])(
    'IT05: user administration (%s) is Administrator-only',
    async (_name, method, path, body, allowed) => {
      expect((await send(method, path(), null, body)).status).toBe(401);
      for (const role of ['CUSTOMER', 'EMPLOYEE', 'MANAGER'])
        expect([
          role,
          (await send(method, path(), tokens[role], body)).status,
        ]).toEqual([role, 403]);
      expect(
        (await send(method, path(), tokens.ADMINISTRATOR, body)).status,
      ).toBe(allowed);
    },
  );

  test('IT06: Administrator+Manager keeps both areas; Administrator alone has no restaurant management', async () => {
    const both = tokens['ADMINISTRATOR+MANAGER'];
    expect((await send('get', '/users', both)).status).toBe(200);
    expect((await send('get', '/stock', both)).status).toBe(200);
    expect((await send('get', '/stock', tokens.ADMINISTRATOR)).status).toBe(
      403,
    );
  });
});