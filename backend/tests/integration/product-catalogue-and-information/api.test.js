import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createCatalogueModule } from '../../../src/modules/product-catalogue-and-information/index.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { createUser } from '../../helpers/createUser.js';
import {
  category,
  componentConfiguration,
  facts,
  predefinedPizza,
  product,
  size,
} from '../../helpers/catalogueFixtures.js';

const security = {
  secret: 'catalogue-test-secret-that-is-more-than-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('BCK11 HTTP contract', () => {
  let app;
  let token;
  let factsSnapshot;
  let roots;
  let reader;

  beforeEach(async () => {
    const component = product({
      id: 'PROD-00002',
      name: 'Tomato Sauce',
      sellable: true,
      component: true,
      componentTypeId: 'type-02',
    });
    const hiddenComponent = product({
      id: 'PROD-00003',
      name: 'Tomato Sauce',
      sellable: false,
      component: true,
      componentTypeId: 'type-02',
      pricingMode: null,
      price: null,
    });
    const pizza = product({
      id: 'PROD-00004',
      name: 'Margherita',
      pricingMode: 'COMPONENT_BASED',
      price: null,
    });
    const inactive = product({
      id: 'PROD-00005',
      name: 'Seasonal',
      active: false,
    });
    const small = size();
    roots = [component, pizza, inactive];
    factsSnapshot = facts({
      roots,
      products: [...roots, hiddenComponent],
      categories: [category()],
      pizzas: [
        predefinedPizza({
          productId: pizza.getId().getValue(),
          componentIds: [hiddenComponent.getId().getValue()],
        }),
      ],
      configurations: [
        componentConfiguration({
          component: hiddenComponent,
          size: small,
          price: '2.50',
        }),
      ],
      sizes: [small],
    });
    reader = {
      loadSellable: jest.fn().mockResolvedValue(factsSnapshot),
      loadFor: jest.fn().mockResolvedValue(factsSnapshot),
    };

    const users = new MemoryUserRepository();
    const userModule = createUserModule({ repository: users, security });
    const email = 'catalogue-customer@example.com';
    const user = createUser({
      name: 'Catalogue Customer',
      email,
      passwordHash: await userModule.hasher.hash('long-password'),
      roles: ['CUSTOMER'],
    });
    await users.save(user);
    token = userModule.tokens.generateToken({
      sub: user.getId().getValue(),
      email,
      roles: user.getRoles(),
    });

    const catalogueModule = createCatalogueModule({
      reader,
    });
    app = createApp({ userModule, catalogueModule });
  });

    test('WEB03 IT04: Guest (no token) and an authenticated Customer can read the catalogue', async () => {
    const anonymous = await request(app).get('/api/v1/catalogue');
    expect(anonymous.status).toBe(200);
    expect(anonymous.body.map(({ id }) => id)).toEqual([
      'PROD-00002',
      'PROD-00004',
      'PROD-00005',
    ]);
    // Only public information: no stock quantities, no personal data.
    expect(JSON.stringify(anonymous.body)).not.toMatch(
      /availableUnits|stock|quantity|email|customer/i,
    );

    const detail = await request(app).get('/api/v1/catalogue/PROD-00004');
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe('PROD-00004');
    expect(
      (await request(app).get('/api/v1/catalogue/PROD-99999')).status,
    ).toBe(404);

    const authenticated = await request(app)
      .get('/api/v1/catalogue')
      .set(auth(token));
    expect(authenticated.status).toBe(200);
    expect(authenticated.body).toEqual(anonymous.body);
  });

  test('lists sellable products and searches exact component names case-insensitively', async () => {
    const response = await request(app)
      .get('/api/v1/catalogue')
      .query({ componentName: 'tOmAtO sAuCe' })
      .set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.map(({ id }) => id)).toEqual([
      'PROD-00002',
      'PROD-00004',
    ]);
    expect(response.body[1].pizza.defaultComponents[0].name).toBe(
      'Tomato Sauce',
    );
  });

  test('rejects malformed search query and malformed product id', async () => {
    const invalidQuery = await request(app)
      .get('/api/v1/catalogue')
      .query({ componentName: ' ' })
      .set(auth(token));
    const invalidId = await request(app)
      .get('/api/v1/catalogue/not-a-product-id')
      .set(auth(token));

    expect(invalidQuery.status).toBe(400);
    expect(invalidId.status).toBe(400);
  });

  test('returns inactive sellable products and hides absent product details', async () => {
    const inactive = await request(app)
      .get('/api/v1/catalogue/PROD-00005')
      .set(auth(token));
    const missing = await request(app)
      .get('/api/v1/catalogue/PROD-99999')
      .set(auth(token));

    expect(inactive.status).toBe(200);
    expect(inactive.body.available).toBe(false);
    expect(missing.status).toBe(404);
  });

  test('does not expose non-sellable component details', async () => {
    const response = await request(app)
      .get('/api/v1/catalogue/PROD-00003')
      .set(auth(token));

    expect(response.status).toBe(404);
  });

  test('sanitizes reader failures as a generic server error', async () => {
    reader.loadSellable.mockRejectedValueOnce(
      new Error('database password or SQL should not be exposed'),
    );
    const response = await request(app)
      .get('/api/v1/catalogue')
      .set(auth(token));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { message: 'Internal Server Error', status: 500 },
    });
  });
});
