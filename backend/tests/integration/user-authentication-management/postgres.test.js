import '../../../src/shared/config/index.js';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { UserRepository } from '../../../src/modules/user-authentication-management/infrastructure/persistence/UserRepository.js';
import { createUser } from '../../helpers/createUser.js';
import { User } from '../../../src/modules/user-authentication-management/domain/model/User.js';
import {
  Email,
  UserId,
} from '../../../src/modules/user-authentication-management/domain/model/values.js';
import { UserResponseMapper } from '../../../src/modules/user-authentication-management/application/mapping/UserResponseMapper.js';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import request from 'supertest';
import { bootstrapManager } from '../../../src/modules/user-authentication-management/infrastructure/bootstrapManager.js';
import { PasswordRecoveryService } from '../../../src/modules/user-authentication-management/application/services/PasswordRecoveryService.js';
import { PostgresRecoveryTokenRepository } from '../../../src/modules/user-authentication-management/infrastructure/persistence/PostgresRecoveryTokenRepository.js';
import { RecoveryTokenServiceAdapter } from '../../../src/modules/user-authentication-management/infrastructure/security/RecoveryTokenService.js';
import { BcryptPasswordHasher } from '../../../src/modules/user-authentication-management/infrastructure/security/BcryptPasswordHasher.js';
import { PostgresUnitOfWork } from '../../../src/shared/persistence/postgres/PostgresUnitOfWork.js';
const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const hash = '$2b$10$' + 'a'.repeat(53);
const user = (email = 'ana@example.com', roles = ['CUSTOMER']) =>
  createUser({ name: 'Ana', email, passwordHash: hash, roles });
const security = {
  secret: 'postgres-test-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const unavailableInvitationDelivery = {
  async sendInvitation() {
    throw new Error('SMTP disabled in PostgreSQL integration tests');
  },
};
describeDB(
  'BCK01 PostgreSQL (isolated schema in dedicated _test database)',
  () => {
    let database, repository;
    beforeAll(async () => {
      database = await isolatedDatabase();
      repository = new UserRepository(database);
    });
    afterAll(async () => {
      await database?.close();
    });
    test('migrates existing UUID users and customer links to business IDs', async () => {
      const migrationDirectory = new URL(
        '../../../migrations/',
        import.meta.url,
      );
      const files = (await readdir(migrationDirectory))
        .filter((name) => name.endsWith('.sql'))
        .sort();
      const legacyDirectory = await mkdtemp(join(tmpdir(), 'bck01-legacy-'));
      const legacyMigrations = ['0001_users.sql', '0002_customers.sql'];
      try {
        for (const name of legacyMigrations)
          await writeFile(
            join(legacyDirectory, name),
            await readFile(new URL(name, migrationDirectory)),
          );
        const legacyUrl = pathToFileURL(legacyDirectory + sep);
        expect(await migrate(database, legacyUrl)).toBe(2);
        const oldUserId = 'e4b2d3c1-0000-4000-8000-000000000001';
        await database.query(
          `INSERT INTO users
            (id, name, email, password_hash, roles, active,
             marketing_consent_given, marketing_consent_timestamp,
             created_at, updated_at)
           VALUES ($1, 'Legacy User', 'legacy@example.com', $2,
                   ARRAY['CUSTOMER'], true, false, now(), now(), now())`,
          [oldUserId, hash],
        );
        await database.query(
          `INSERT INTO customers (id, name, phone_number, email, user_id)
           VALUES ('CUST-00001', 'Legacy Customer', '+351912345678',
                   'legacy.customer@example.com', $1)`,
          [oldUserId],
        );

        expect(await migrate(database)).toBe(files.length - 2);
        expect(await migrate(database)).toBe(0);
        const { rows: users } = await database.query(
          'SELECT id FROM users WHERE email = $1',
          ['legacy@example.com'],
        );
        const { rows: customers } = await database.query(
          'SELECT user_id FROM customers WHERE email = $1',
          ['legacy.customer@example.com'],
        );
        expect(users[0].id).toBe('USR-00001');
        expect(customers[0].user_id).toBe('USR-00001');
        expect(await repository.nextId()).toBe('USR-00002');
      } finally {
        await rm(legacyDirectory, { recursive: true, force: true });
      }
    });
    test('generates sequential business identifiers for users', async () => {
      expect(await repository.nextId()).toBe('USR-00003');
      expect(await repository.nextId()).toBe('USR-00004');
    });
    test('round-trips complete Users through the diagram repository contract without exposing hashes', async () => {
      const original = user();
      const saved = await repository.save(original);
      expect(saved).toBeInstanceOf(User);
      const restored = await repository.findByEmail(original.getEmail());
      expect(restored.getId().equals(original.getId())).toBe(true);
      expect(restored.getPassword().getHash()).toBe(hash);
      expect(restored.createdAt).toEqual(original.createdAt);
      expect(
        await repository.existsByEmail(Email.create('ANA@example.com')),
      ).toBe(true);
      expect(
        await repository.existsByEmail(Email.create('unknown@example.com')),
      ).toBe(false);
      const byId = await repository.findById(original.getId());
      expect(byId).toBeInstanceOf(User);
      const all = await repository.findAll();
      expect(all[0]).toBeInstanceOf(User);
      expect(JSON.stringify(UserResponseMapper.toDTO(byId))).not.toMatch(
        /password|hash/i,
      );
      expect(JSON.stringify(UserResponseMapper.toDTOList(all))).not.toMatch(
        /password|hash/i,
      );
      expect(JSON.stringify(restored)).not.toContain(hash);
    });
    test('conditionally updates a password only while the verified hash and active account are unchanged', async () => {
      const original = await repository.save(
        user('password-change@example.com'),
      );
      const nextHash = '$2b$10$' + 'b'.repeat(53);

      await expect(
        repository.updatePasswordIfCurrent(original.getId(), hash, nextHash),
      ).resolves.toBe(true);
      await expect(
        repository.updatePasswordIfCurrent(
          original.getId(),
          hash,
          '$2b$10$' + 'c'.repeat(53),
        ),
      ).resolves.toBe(false);
      expect(
        (await repository.findById(original.getId())).getPassword().getHash(),
      ).toBe(nextHash);

      const inactive = await repository.save(
        user('inactive-password@example.com'),
      );
      inactive.deactivate();
      const deactivated = await repository.save(inactive);
      await expect(
        repository.updatePasswordIfCurrent(
          deactivated.getId(),
          hash,
          '$2b$10$' + 'd'.repeat(53),
        ),
      ).resolves.toBe(false);
    });
    test('invalidates replaced links and permits at most one concurrent recovery completion', async () => {
      const account = await repository.save(user('recovery@example.com'));
      const recoveryRepository = new PostgresRecoveryTokenRepository(database);
      const tokens = new RecoveryTokenServiceAdapter();
      const first = tokens.createLinkToken();
      const current = tokens.createLinkToken();
      const expiresAt = new Date(Date.now() + 60_000);

      await database.withTransaction((tx) =>
        recoveryRepository.replaceActive(
          account.getId().getValue(),
          first.tokenHash,
          expiresAt,
          tx,
        ),
      );
      await database.withTransaction((tx) =>
        recoveryRepository.replaceActive(
          account.getId().getValue(),
          current.tokenHash,
          expiresAt,
          tx,
        ),
      );
      await database.withTransaction(async (tx) => {
        await expect(
          recoveryRepository.findUsableForUpdate(first.tokenHash, tx),
        ).resolves.toBeNull();
      });

      const service = new PasswordRecoveryService({
        userRepository: repository,
        recoveryRepository,
        tokenService: tokens,
        passwordHasher: new BcryptPasswordHasher(),
        delivery: {},
        unitOfWork: new PostgresUnitOfWork(database),
      });
      const complete = () =>
        service.completeRecovery(current.plaintextToken, 'DifferentSecure456!');
      const attempts = await Promise.allSettled([complete(), complete()]);

      expect(
        attempts.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        attempts.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      expect(
        attempts.find((result) => result.status === 'rejected').reason,
      ).toMatchObject({
        status: 422,
        message: 'Invalid or expired recovery link',
      });
      const { rows: consumedRows } = await database.query(
        'SELECT consumed_at FROM password_recovery_tokens WHERE token_hash = $1',
        [current.tokenHash],
      );
      expect(consumedRows[0].consumed_at).toBeInstanceOf(Date);
      expect(
        (await repository.findById(account.getId())).getPassword().getHash(),
      ).not.toBe(hash);
    });
    test('enforces normalized unique emails during concurrent inserts', async () => {
      const attempts = await Promise.allSettled([
        repository.save(user('RACE@example.com')),
        repository.save(user('race@example.com')),
      ]);
      expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
      expect(
        attempts.find((a) => a.status === 'rejected').reason,
      ).toMatchObject({ status: 409 });
    });
    // AA03 (IT09): 0..4 distinct roles from the Table 1 set are accepted.
    test.each([
      "'{}'::text[]",
      "ARRAY['ADMINISTRATOR']",
      "ARRAY['ADMINISTRATOR','MANAGER','EMPLOYEE','CUSTOMER']",
    ])('accepts the AA03 role set through SQL: %s', async (roles) => {
      await database.query(
        `UPDATE users SET roles = ${roles} WHERE email = $1`,
        ['ana@example.com'],
      );
      const stored = await repository.findByEmail(
        Email.create('ana@example.com'),
      );
      expect(stored.getRoles()).toEqual(
        (
          await database.query('SELECT roles FROM users WHERE email = $1', [
            'ana@example.com',
          ])
        ).rows[0].roles,
      );
    });
    test.each([
      "ARRAY['ROOT']",
      "ARRAY['ADMIN']",
      "ARRAY['CUSTOMER',NULL]",
      "ARRAY['CUSTOMER','CUSTOMER']",
      "ARRAY[['CUSTOMER']]",
      'NULL',
    ])('rejects invalid roles through SQL: %s', async (roles) => {
      await expect(
        database.query(`UPDATE users SET roles = ${roles} WHERE email = $1`, [
          'ana@example.com',
        ]),
      ).rejects.toHaveProperty('code');
    });
    test('rejects noncanonical emails and invalid credential/name/consent data through SQL', async () => {
      for (const sql of [
        "email = 'ANA@example.com'",
        "name = ' '",
        "password_hash = 'plaintext'",
        'marketing_consent_timestamp = NULL',
      ])
        await expect(
          database.query(`UPDATE users SET ${sql} WHERE email = $1`, [
            'ana@example.com',
          ]),
        ).rejects.toHaveProperty('code');
    });
    test('persists aggregate role/deactivation changes and keeps deactivation idempotent', async () => {
      const current = await repository.findByEmail(
        Email.create('ana@example.com'),
      );
      current.setRoles(['MANAGER', 'CUSTOMER']);
      const changed = await repository.save(current);
      expect(changed.getRoles()).toEqual(['MANAGER', 'CUSTOMER']);
      changed.deactivate();
      const first = await repository.save(changed);
      first.deactivate();
      const second = await repository.save(first);
      expect(second.updatedAt).toEqual(first.updatedAt);
      expect(second.isActive()).toBe(false);
      expect(
        await repository.findByEmail(Email.create('ana@example.com')),
      ).not.toBeNull();
      expect(
        (await repository.findAll()).some((u) =>
          u.getId().equals(current.getId()),
        ),
      ).toBe(false);
      expect(await repository.findById(UserId.create('USR-99999'))).toBeNull();
    });
    test('saving roles from a stale aggregate does not undo concurrent deactivation', async () => {
      const original = await repository.save(user('concurrent@example.com'));
      const roleChange = await repository.findById(original.getId());
      const deactivation = await repository.findById(original.getId());
      deactivation.deactivate();
      await repository.save(deactivation);
      roleChange.setRoles(['CUSTOMER', 'EMPLOYEE']);
      const result = await repository.save(roleChange);
      expect(result.isActive()).toBe(false);
      expect(result.getRoles()).toEqual(['CUSTOMER', 'EMPLOYEE']);
    });
    test('persists consent and activation through the aggregate methods', async () => {
      const { MarketingConsent } =
        await import('../../../src/modules/user-authentication-management/domain/model/values.js');
      const current = await repository.findByEmail(
        Email.create('concurrent@example.com'),
      );
      const recordedAt = new Date();
      current.updateMarketingConsent(MarketingConsent.create(true, recordedAt));
      current.activate();
      const saved = await repository.save(current);
      expect(saved.getMarketingConsent().isGiven()).toBe(true);
      expect(saved.getMarketingConsent().getTimestamp()).toEqual(recordedAt);
      expect(saved.isActive()).toBe(true);
    });
    test('bootstraps exactly one Manager under concurrent commands', async () => {
      const attempts = await Promise.allSettled([
        bootstrapManager(database, {
          name: 'Initial',
          email: 'initial1@example.com',
          password: 'StrongPass123!',
        }),
        bootstrapManager(database, {
          name: 'Initial',
          email: 'initial2@example.com',
          password: 'StrongPass123!',
        }),
      ]);
      expect(
        attempts.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        attempts.find((result) => result.status === 'rejected').reason.message,
      ).toContain('already exists');
    });
    test('runs register/login/management over HTTP against PostgreSQL', async () => {
      const module = createUserModule({
        database,
        security,
        invitationDelivery: unavailableInvitationDelivery,
      });
      const app = createApp({ userModule: module });
      const manager = createUser({
        name: 'Manager',
        email: 'manager@example.com',
        passwordHash: await module.hasher.hash('long-password'),
        roles: ['MANAGER', 'ADMINISTRATOR'],
      });
      await repository.save(manager);
      const token = module.tokens.generateToken({
        sub: manager.getId().getValue(),
        email: manager.getEmail().getValue(),
        roles: manager.getRoles(),
      });
      const registered = await request(app)
        .post('/api/v1/users/register')
        .send({
          name: 'Customer',
          email: 'http@example.com',
          password: 'StrongPass123!',
          phoneNumber: '+351912345678',
        });
      expect(registered.status).toBe(201);
      expect(registered.body.active).toBe(false);
      const inactive = await repository.findById(
        UserId.create(registered.body.id),
      );
      expect(inactive.isActive()).toBe(false);
      inactive.activateByInvitation();
      await repository.save(inactive);
      const loggedIn = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'HTTP@example.com', password: 'StrongPass123!' });
      expect(loggedIn.status).toBe(200);
      const id = registered.body.id;
      const roles = await request(app)
        .patch(`/api/v1/users/${id}/roles`)
        .auth(token, { type: 'bearer' })
        .send({ roles: ['CUSTOMER', 'ADMINISTRATOR'] });
      expect(roles.status).toBe(200);
      expect(
        (
          await request(app)
            .get('/api/v1/users')
            .auth(loggedIn.body.accessToken, { type: 'bearer' })
        ).status,
      ).toBe(200);
      expect(
        (
          await request(app)
            .delete(`/api/v1/users/${id}`)
            .auth(token, { type: 'bearer' })
        ).status,
      ).toBe(204);
      // AA03 (BR 8): a token of an account deactivated after login gets the
      // access-denied message instead of an authentication failure.
      const afterDeactivation = await request(app)
        .get('/api/v1/users')
        .auth(loggedIn.body.accessToken, { type: 'bearer' });
      expect(afterDeactivation.status).toBe(403);
      expect(afterDeactivation.body).toEqual({
        error: { message: 'Account is not active', status: 403 },
      });
    });
    test('AA06 persists role audit, invitation replacement, and last-Administrator protection', async () => {
      const module = createUserModule({
        database,
        security,
        invitationDelivery: unavailableInvitationDelivery,
      });
      const admin = await repository.save(
        user('aa06-admin@example.com', ['ADMINISTRATOR']),
      );
      await database.query(
        "UPDATE users SET roles = array_remove(roles, 'ADMINISTRATOR') WHERE id <> $1",
        [admin.getId().getValue()],
      );
      const token = module.tokens.generateToken({
        sub: admin.getId().getValue(),
      });
      const created = await module.userService.register({
        name: 'Invitee',
        email: 'aa06-invitee@example.com',
        password: 'StrongPass123!',
      });
      expect(created).toMatchObject({ active: false, roles: ['CUSTOMER'] });
      const roleResponse = await request(createApp({ userModule: module }))
        .patch(`/api/v1/users/${created.id}/roles`)
        .auth(token, { type: 'bearer' })
        .send({ roles: ['CUSTOMER', 'EMPLOYEE'] });
      expect(roleResponse.status).toBe(200);
      const audit = await database.query(
        'SELECT actor_type, actor_user_id, system_process, previous_roles, new_roles FROM role_change_records WHERE user_id = $1 ORDER BY changed_at',
        [created.id],
      );
      expect(audit.rows).toHaveLength(2);
      expect(audit.rows[0]).toMatchObject({
        actor_type: 'SYSTEM_PROCESS',
        system_process: 'INITIAL_CUSTOMER_ASSIGNMENT',
      });
      expect(audit.rows[1]).toMatchObject({
        actor_type: 'ADMINISTRATOR',
        actor_user_id: admin.getId().getValue(),
      });

      const app = createApp({ userModule: module });
      const invite = () =>
        request(app)
          .post(`/api/v1/users/${created.id}/activation-invitations`)
          .auth(token, { type: 'bearer' });
      expect((await invite()).body).toMatchObject({
        deliveryStatus: 'FAILED',
        retryable: true,
      });
      expect((await invite()).body.deliveryStatus).toBe('FAILED');
      const pending = await database.query(
        "SELECT encode(token_hash, 'hex') AS token_hash FROM activation_invitations WHERE user_id = $1 AND status = 'PENDING'",
        [created.id],
      );
      await database.query(
        "UPDATE activation_invitations SET expires_at = now() - interval '1 second' WHERE user_id = $1 AND status = 'PENDING'",
        [created.id],
      );
      const usableInvitation =
        await module.userService.unitOfWork.withTransaction((tx) =>
          module.userService.invitationRepository.findUsableForUpdate(
            pending.rows[0].token_hash,
            tx,
          ),
        );
      expect(usableInvitation).toBeNull();
      expect((await invite()).body.deliveryStatus).toBe('FAILED');
      const invitations = await database.query(
        'SELECT status FROM activation_invitations WHERE user_id = $1 ORDER BY created_at',
        [created.id],
      );
      expect(invitations.rows.map((row) => row.status)).toEqual([
        'INVALIDATED',
        'INVALIDATED',
        'EXPIRED',
        'PENDING',
      ]);

      const secondAdmin = await repository.save(
        user('aa06-second-admin@example.com', ['ADMINISTRATOR']),
      );
      const secondToken = module.tokens.generateToken({
        sub: secondAdmin.getId().getValue(),
      });
      const removeAdmin = (targetId, actorToken) =>
        request(app)
          .patch(`/api/v1/users/${targetId}/roles`)
          .auth(actorToken, { type: 'bearer' })
          .send({ roles: [] });
      const [firstRemoval, secondRemoval] = await Promise.all([
        removeAdmin(admin.getId().getValue(), token),
        removeAdmin(secondAdmin.getId().getValue(), secondToken),
      ]);
      expect([firstRemoval.status, secondRemoval.status].sort()).toEqual([
        200, 409,
      ]);
      const remaining = await database.query(
        "SELECT id FROM users WHERE active AND 'ADMINISTRATOR' = ANY(roles)",
      );
      expect(remaining.rows).toHaveLength(1);
      const remainingToken = module.tokens.generateToken({
        sub: remaining.rows[0].id,
      });
      const lastAdminRemoval = await removeAdmin(
        remaining.rows[0].id,
        remainingToken,
      );
      expect(lastAdminRemoval.status).toBe(409);
    });
    test('migration has no plaintext bootstrap credentials', async () => {
      const sql = await readFile(
        new URL('../../../migrations/0001_users.sql', import.meta.url),
        'utf8',
      );
      expect(sql).not.toMatch(/INSERT INTO users/i);
    });
  },
);
