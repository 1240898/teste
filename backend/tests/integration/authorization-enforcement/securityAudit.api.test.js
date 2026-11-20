import request from 'supertest';
import { Router } from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from '../../../src/shared/errors/AppError.js';
import { createApp } from '../../../src/app.js';
import { createAuthorizationEnforcementModule } from '../../../src/modules/authorization-enforcement/index.js';
import { FileSecurityAuditOutbox } from '../../../src/modules/authorization-enforcement/infrastructure/FileSecurityAuditOutbox.js';
import { OwnershipMiddleware } from '../../../src/modules/authorization-enforcement/api/middlewares/OwnershipMiddleware.js';
import { RoleMiddleware } from '../../../src/modules/authorization-enforcement/api/middlewares/RoleMiddleware.js';
import { AuthMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/authMiddleware.js';

describe('AA05 security audit API', () => {
  let app;
  let savedEvents;
  let userService;
  let repository;
  let searchCriteria;
  let securityLogger;
  let outboxDirectory;

  beforeEach(async () => {
    outboxDirectory = await mkdtemp(join(tmpdir(), 'aa05-audit-api-'));
    savedEvents = [];
    searchCriteria = null;
    const actorsByToken = {
      admin: { sub: 'USR-00001', roles: ['ADMINISTRATOR'] },
      manager: { sub: 'USR-00002', roles: ['MANAGER'] },
      employee: { sub: 'USR-00003', roles: ['EMPLOYEE'] },
      customer: { sub: 'USR-00004', roles: ['CUSTOMER'] },
      multiRole: { sub: 'USR-00005', roles: ['EMPLOYEE', 'CUSTOMER'] },
    };
    userService = {
      async resolveActor(token) {
        const actor = actorsByToken[token];
        if (!actor) throw new AppError('Invalid token', 401);
        return actor;
      },
    };
    repository = {
      async save(event) {
        savedEvents.push(event);
      },
      async search(criteria) {
        searchCriteria = criteria;
        return {
          items: [],
          total: 0,
          limit: criteria.limit,
          offset: criteria.offset,
        };
      },
    };
    const authorizationModule = createAuthorizationEnforcementModule({
      userService,
      repository,
      outbox: new FileSecurityAuditOutbox(outboxDirectory),
      logger: { error() {} },
    });
    securityLogger = authorizationModule.securityLogger;
    const customerRouter = Router();
    const auth = new AuthMiddleware(userService);
    customerRouter.get(
      '/customers/:id',
      auth.verifyToken,
      RoleMiddleware.requireOperation('customers.getById'),
      new OwnershipMiddleware({ isOwner: async () => false }).requireOwnership(
        'customers.getById',
        'id',
      ),
      (_req, res) => res.status(200).json({ ok: true }),
    );
    customerRouter.get(
      '/aa05/products',
      auth.verifyToken,
      RoleMiddleware.requireOperation('products.read'),
      (_req, res) => res.status(200).json({ ok: true }),
    );
    customerRouter.patch(
      '/aa05/products/:id',
      auth.verifyToken,
      RoleMiddleware.requireOperation('products.update'),
      (_req, res) => res.status(200).json({ ok: true }),
    );
    const nestedRouter = Router();
    nestedRouter.get(
      '/detail/:id',
      auth.verifyToken,
      RoleMiddleware.requireOperation('products.update'),
      (_req, res) => res.status(200).json({ ok: true }),
    );
    customerRouter.use('/aa05/nested', nestedRouter);
    app = createApp({
      authorizationModule,
      customerModule: { router: customerRouter },
      securityLogger: authorizationModule.securityLogger,
    });
  });

  afterEach(async () => {
    await securityLogger.flush();
    await rm(outboxDirectory, { recursive: true, force: true });
  });

  test('allows only Administrator to search logs and audits denied access', async () => {
    const adminResponse = await request(app)
      .get('/api/v1/security/audit-logs?limit=10&outcome=FORBIDDEN')
      .set('Authorization', 'Bearer admin');
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body).toMatchObject({
      items: [],
      total: 0,
      limit: 10,
      offset: 0,
    });

    for (const token of ['manager', 'employee', 'customer', 'multiRole']) {
      const denied = await request(app)
        .get('/api/v1/security/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      expect(denied.status).toBe(403);
    }

    const unauthenticated = await request(app).get(
      '/api/v1/security/audit-logs',
    );
    expect(unauthenticated.status).toBe(401);

    await securityLogger.flush();
    expect(savedEvents.map((event) => event.outcome)).toContain('FORBIDDEN');
    expect(savedEvents.map((event) => event.outcome)).toContain(
      'UNAUTHENTICATED',
    );
    expect(savedEvents.every((event) => !('requestBody' in event))).toBe(true);
    expect(savedEvents.every((event) => !('authorization' in event))).toBe(
      true,
    );
  });

  test('rejects invalid filters before querying the repository', async () => {
    const response = await request(app)
      .get('/api/v1/security/audit-logs?limit=1000')
      .set('Authorization', 'Bearer admin');

    expect(response.status).toBe(400);
  });

  test('enforces representative base-role permissions at the API boundary', async () => {
    for (const token of [
      'admin',
      'manager',
      'employee',
      'customer',
      'multiRole',
    ]) {
      expect(
        (
          await request(app)
            .get('/api/v1/aa05/products')
            .set('Authorization', `Bearer ${token}`)
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await request(app)
          .patch('/api/v1/aa05/products/PROD-00001')
          .set('Authorization', 'Bearer manager')
      ).status,
    ).toBe(200);
    for (const token of ['admin', 'employee', 'customer', 'multiRole']) {
      expect(
        (
          await request(app)
            .patch('/api/v1/aa05/products/PROD-00001')
            .set('Authorization', `Bearer ${token}`)
        ).status,
      ).toBe(403);
    }
  });

  test('passes valid search filters and pagination to the query service', async () => {
    const response = await request(app)
      .get(
        '/api/v1/security/audit-logs?limit=12&offset=4&outcome=OWNERSHIP_DENIED&actorId=USR-00004&from=2026-11-01T00:00:00.000Z&to=2026-11-12T23:59:59.000Z',
      )
      .set('Authorization', 'Bearer admin');

    expect(response.status).toBe(200);
    expect(searchCriteria).toMatchObject({
      limit: 12,
      offset: 4,
      outcome: 'OWNERSHIP_DENIED',
      actorId: 'USR-00004',
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-12T23:59:59.000Z',
    });
  });

  test('records ownership failures as concealed 404 events', async () => {
    const response = await request(app)
      .get('/api/v1/customers/CUST-00001')
      .set('Authorization', 'Bearer customer');

    expect(response.status).toBe(404);
    await securityLogger.flush();
    expect(savedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: 'OWNERSHIP_DENIED',
          statusCode: 404,
          routeTemplate: '/api/v1/customers/:id',
          actorId: 'USR-00004',
        }),
      ]),
    );
  });

  test('audits full nested route templates without IDs or sensitive query values', async () => {
    const response = await request(app)
      .get(
        '/api/v1/aa05/nested/detail/PROD-00001?email=private@example.com&token=secret',
      )
      .set('Authorization', 'Bearer customer');

    expect(response.status).toBe(403);
    await securityLogger.flush();
    const event = savedEvents.find(
      ({ routeTemplate }) => routeTemplate === '/api/v1/aa05/nested/detail/:id',
    );
    expect(event).toMatchObject({
      method: 'GET',
      outcome: 'FORBIDDEN',
      routeTemplate: '/api/v1/aa05/nested/detail/:id',
    });
    expect(JSON.stringify(event)).not.toContain('PROD-00001');
    expect(JSON.stringify(event)).not.toContain('private@example.com');
    expect(JSON.stringify(event)).not.toContain('secret');
  });
});
