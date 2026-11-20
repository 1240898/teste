
import '../../../src/shared/config/index.js';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { createUser } from '../../helpers/createUser.js';

import { createApp } from '../../../src/app.js';
import { UserRepository } from '../../../src/modules/user-authentication-management/infrastructure/persistence/UserRepository.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createProductManagementModule } from '../../../src/modules/product-management/index.js';
import { createAuthorizationEnforcementModule } from '../../../src/modules/authorization-enforcement/index.js';
import { FileSecurityAuditOutbox } from '../../../src/modules/authorization-enforcement/infrastructure/FileSecurityAuditOutbox.js';

const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

const security = {
  secret: 'postgres-test-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};

const hash = '$2b$10$' + 'a'.repeat(53);

const unavailableInvitationDelivery = {
  async sendInvitation() {
    throw new Error('SMTP disabled in PostgreSQL integration tests');
  },
};

describeDB('AA05 PostgreSQL integration', () => {
  let database;
  let repository;
  let userModule;
  let app;
  let employeeId;
  let securityLogger;
  let outboxDirectory;

  beforeAll(async () => {
    outboxDirectory = await mkdtemp(join(tmpdir(), 'aa05-postgres-outbox-'));
    database = await isolatedDatabase();
    await migrate(database);

    repository = new UserRepository(database);

    userModule = createUserModule({
      database,
      security,
      invitationDelivery: unavailableInvitationDelivery,
    });

    const productModule = createProductManagementModule({
      database,
      userService: userModule.userService,
    });

    const authorizationModule = createAuthorizationEnforcementModule({
      database,
      userService: userModule.userService,
      outbox: new FileSecurityAuditOutbox(outboxDirectory),
    });
    securityLogger = authorizationModule.securityLogger;

    app = createApp({
      userModule,
      productModule,
      authorizationModule,
      securityLogger: authorizationModule.securityLogger,
    });
  });

  afterAll(async () => {
    userModule?.dispose();
    await securityLogger?.stop();
    await database?.close();
    if (outboxDirectory)
      await rm(outboxDirectory, { recursive: true, force: true });
  });

  async function createAccount(name, email, roles) {
    const user = await repository.save(
      createUser({
        name,
        email,
        passwordHash: hash,
        roles,
      }),
    );

    const token = userModule.tokens.generateToken({
      sub: user.getId().getValue(),
      email: user.getEmail().getValue(),
      roles: user.getRoles(),
    });

    return {
      user,
      token,
      id: user.getId().getValue(),
    };
  }

  async function waitForAuditEvent({ actorId, method, statusCode }) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const result = await database.query(
        `SELECT outcome, method, route_template, status_code,
                actor_id, actor_roles
           FROM security_audit_logs
          WHERE actor_id IS NOT DISTINCT FROM $1
            AND method = $2
            AND status_code = $3
          ORDER BY occurred_at DESC
          LIMIT 1`,
        [actorId, method, statusCode],
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    return undefined;
  }

  test('regista no PostgreSQL uma tentativa de criação de produto recusada a um Employee', async () => {
    const employee = await createAccount(
      'AA05 Employee',
      'aa05-employee@example.com',
      ['EMPLOYEE'],
    );

    employeeId = employee.id;

    const response = await request(app)
      .post('/api/v1/products')
      .auth(employee.token, { type: 'bearer' })
      .send({});

    expect(response.status).toBe(403);

    const auditEvent = await waitForAuditEvent({
      actorId: employee.id,
      method: 'POST',
      statusCode: 403,
    });

    expect(auditEvent).toBeDefined();
    expect(auditEvent).toMatchObject({
      outcome: 'FORBIDDEN',
      method: 'POST',
      status_code: 403,
      actor_id: employee.id,
      actor_roles: ['EMPLOYEE'],
    });
  });

  test('regista no PostgreSQL uma tentativa de acesso sem autenticação', async () => {
    const response = await request(app).get(
      '/api/v1/security/audit-logs',
    );

    expect(response.status).toBe(401);

    const auditEvent = await waitForAuditEvent({
      actorId: null,
      method: 'GET',
      statusCode: 401,
    });

    expect(auditEvent).toBeDefined();
    expect(auditEvent).toMatchObject({
      outcome: 'UNAUTHENTICATED',
      method: 'GET',
      status_code: 401,
      actor_id: null,
      actor_roles: [],
    });
  });

  test('regista no PostgreSQL uma tentativa de consulta de auditoria recusada a um Employee', async () => {
    const employee = await createAccount(
      'AA05 Audit Employee',
      'aa05-audit-employee@example.com',
      ['EMPLOYEE'],
    );

    const response = await request(app)
      .get('/api/v1/security/audit-logs')
      .auth(employee.token, { type: 'bearer' });

    expect(response.status).toBe(403);

    const auditEvent = await waitForAuditEvent({
      actorId: employee.id,
      method: 'GET',
      statusCode: 403,
    });

    expect(auditEvent).toBeDefined();
    expect(auditEvent).toMatchObject({
      outcome: 'FORBIDDEN',
      method: 'GET',
      status_code: 403,
      actor_id: employee.id,
      actor_roles: ['EMPLOYEE'],
    });
  });

  test('permite a um Administrator consultar eventos persistidos no PostgreSQL', async () => {
    expect(employeeId).toBeDefined();

    const administrator = await createAccount(
      'AA05 Administrator',
      'aa05-administrator@example.com',
      ['ADMINISTRATOR'],
    );

    const response = await request(app)
      .get('/api/v1/security/audit-logs')
      .query({
        actorId: employeeId,
        outcome: 'FORBIDDEN',
        limit: 10,
        offset: 0,
      })
      .auth(administrator.token, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      limit: 10,
      offset: 0,
    });

    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: 'FORBIDDEN',
          method: 'POST',
          statusCode: 403,
          actorId: employeeId,
          actorRoles: ['EMPLOYEE'],
        }),
      ]),
    );
  });
});
