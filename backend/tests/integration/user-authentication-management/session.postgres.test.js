import '../../../src/shared/config/index.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { UserRepository } from '../../../src/modules/user-authentication-management/infrastructure/persistence/UserRepository.js';
import { PostgresApplicationSessionRepository } from '../../../src/modules/user-authentication-management/infrastructure/persistence/PostgresApplicationSessionRepository.js';
import { SessionCredentialService } from '../../../src/modules/user-authentication-management/infrastructure/security/SessionCredentialService.js';
import { createUser } from '../../helpers/createUser.js';

const describeDatabase =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

describeDatabase(
  'AA04 PostgreSQL application-session repository (dedicated _test database)',
  () => {
    let database;
    let sessions;
    let userRepository;

    beforeAll(async () => {
      database = await isolatedDatabase();
      await migrate(database);
      sessions = new PostgresApplicationSessionRepository(database);
      userRepository = new UserRepository(database);
      await userRepository.save(
        createUser({
          id: 'USR-94001',
          name: 'Session Test User',
          email: 'aa04-session-test@example.com',
          passwordHash: '$2b$10$' + 'a'.repeat(53),
          roles: ['CUSTOMER'],
        }),
      );
    });

    afterAll(async () => {
      await database?.close();
    });

    test('migrates, creates, renews, and revokes sessions using PostgreSQL', async () => {
      const credentialService = new SessionCredentialService();
      const initial = credentialService.create();
      const created = await sessions.create({
        id: initial.id,
        userId: 'USR-94001',
        hash: initial.hash,
        csrfToken: initial.csrfTokenBytes,
        idleSeconds: 600,
      });

      expect(created.id).toBe(initial.id);
      expect(created.user_id).toBe('USR-94001');
      expect(created.idle_expires_at).toBeInstanceOf(Date);
      expect(await sessions.findActive(initial.id, 'USR-94001')).toMatchObject({
        id: initial.id,
        user_id: 'USR-94001',
      });
      expect(
        await sessions.findByCredential(initial.id, initial.hash),
      ).not.toBeNull();

      // An active user must be able to renew beyond the former eight-hour cap.
      await database.query(
        `UPDATE application_sessions SET created_at = clock_timestamp() - interval '9 hours'
         WHERE id = $1`,
        [initial.id],
      );
      const replacement = credentialService.create();
      const renewed = await sessions.renew(
        initial.id,
        initial.hash,
        initial.csrfTokenBytes,
        {
          id: replacement.id,
          hash: replacement.hash,
          csrfToken: replacement.csrfTokenBytes,
        },
        600,
      );

      expect(renewed).toMatchObject({
        id: replacement.id,
        user_id: 'USR-94001',
      });
      expect(
        await sessions.findByCredential(initial.id, initial.hash),
      ).toBeNull();
      expect(
        await sessions.findActive(replacement.id, 'USR-94001'),
      ).not.toBeNull();

      await expect(
        sessions.revoke(
          replacement.id,
          replacement.hash,
          initial.csrfTokenBytes,
        ),
      ).resolves.toBe(false);
      await expect(
        sessions.revoke(
          replacement.id,
          replacement.hash,
          replacement.csrfTokenBytes,
        ),
      ).resolves.toBe(true);
      expect(await sessions.findActive(replacement.id, 'USR-94001')).toBeNull();
      expect(
        await sessions.findResumable(replacement.id, replacement.hash),
      ).toBeNull();
    });
  },
);
