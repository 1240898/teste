import '../../../src/shared/config/index.js';
import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { UserRepository } from '../../../src/modules/user-authentication-management/infrastructure/persistence/UserRepository.js';
import { User } from '../../../src/modules/user-authentication-management/domain/model/User.js';
import {
  Email,
  ExternalIdentity,
  MarketingConsent,
  UserId,
  UserName,
} from '../../../src/modules/user-authentication-management/domain/model/values.js';
import { createUser } from '../../helpers/createUser.js';

const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const hash = '$2b$10$' + 'a'.repeat(53);

describeDB('Main to AA01 PostgreSQL upgrade', () => {
  test('applies every migration after the main schema, including the recovery one', async () => {
    const database = await isolatedDatabase();
    let baselineMigrations;
    try {
      baselineMigrations = await mkdtemp(join(tmpdir(), 'main-migrations-'));
      const migrations = new URL('../../../migrations/', import.meta.url);
      const allMigrations = (await readdir(migrations)).filter((file) =>
        file.endsWith('.sql'),
      );
      const files = allMigrations.filter(
        (file) => Number(file.split('_')[0]) <= 18,
      );
      // Migrations newer than the main baseline (AA01 recovery, AA03 roles, ...).
      const pending = allMigrations.filter((file) => !files.includes(file));
      expect(pending).toContain('0019_password_recovery_tokens.sql');
      for (const file of files)
        await copyFile(new URL(file, migrations), join(baselineMigrations, file));
      await migrate(database, pathToFileURL(baselineMigrations + sep));
      await database.query(
        `INSERT INTO users (id, name, email, password_hash, roles, marketing_consent_timestamp)
         VALUES ('USR-00001', 'Existing', 'existing@example.com', $1, ARRAY['CUSTOMER'], now())`,
        [hash],
      );

      expect(await migrate(database)).toBe(pending.length);
      const user = await new UserRepository(database).findByEmail(
        Email.create('existing@example.com'),
      );
      expect(user.getPassword().getHash()).toBe(hash);
      expect(user.getExternalIdentities()).toEqual([]);
      expect(await migrate(database)).toBe(0);
    } finally {
      try {
        await database.close();
      } finally {
        if (baselineMigrations)
          await rm(baselineMigrations, { recursive: true, force: true });
      }
    }
  });
});

describeDB('AA02 PostgreSQL external identities (isolated schema)', () => {
  let database, repository, sequence;
  const externalUser = async (subject, email) =>
    User.createFromExternalIdentity(
      UserId.create(await repository.nextId()),
      UserName.create('Google User'),
      Email.create(email),
      ExternalIdentity.create('GOOGLE', subject),
      MarketingConsent.create(false),
    );
  beforeAll(async () => {
    database = await isolatedDatabase();
    await migrate(database);
    repository = new UserRepository(database);
    sequence = 0;
  });
  afterAll(async () => {
    await database?.close();
  });
  const uniqueEmail = (prefix) => `${prefix}-${++sequence}@example.com`;

  test('IT06 migration allows external-only accounts and enforces identity uniqueness', async () => {
    expect(await migrate(database)).toBe(0);
    const saved = await repository.save(
      await externalUser('subject-it06', uniqueEmail('google')),
    );
    const { rows } = await database.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [saved.getId().getValue()],
    );
    expect(rows[0].password_hash).toBeNull();

    // Same Google subject for another account: rejected, and no partial user row.
    const duplicateEmail = uniqueEmail('duplicate');
    await expect(
      repository.save(await externalUser('subject-it06', duplicateEmail)),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await repository.findByEmail(Email.create(duplicateEmail)),
    ).toBeNull();

    await expect(
      database.query(
        "INSERT INTO user_external_identities (user_id, provider, subject) VALUES ($1, 'GOOGLE', 'second-google')",
        [saved.getId().getValue()],
      ),
    ).rejects.toMatchObject({
      constraint: 'user_external_identities_user_provider_key',
    });
    for (const [provider, subject] of [
      ['OTHER', 'subject'],
      ['GOOGLE', ''],
    ])
      await expect(
        database.query(
          'INSERT INTO user_external_identities (user_id, provider, subject) VALUES ($1, $2, $3)',
          [saved.getId().getValue(), provider, subject],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    await expect(
      database.query(
        "UPDATE users SET password_hash = 'plaintext' WHERE id = $1",
        [saved.getId().getValue()],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  test('IT06 concurrent first sign-ins create exactly one account', async () => {
    const results = await Promise.allSettled([
      externalUser('subject-race', uniqueEmail('race-a')).then((u) =>
        repository.save(u),
      ),
      externalUser('subject-race', uniqueEmail('race-b')).then((u) =>
        repository.save(u),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({
      status: 409,
    });
    const { rows } = await database.query(
      "SELECT count(*)::int AS n FROM user_external_identities WHERE subject = 'subject-race'",
    );
    expect(rows[0].n).toBe(1);
  });

  test('IT07 every finder returns complete aggregates with identities', async () => {
    const email = uniqueEmail('finder');
    const saved = await repository.save(
      await externalUser('subject-it07', email),
    );
    const id = saved.getId();
    const local = await repository.save(
      createUser({
        name: 'Local',
        email: uniqueEmail('local'),
        passwordHash: hash,
        roles: ['CUSTOMER'],
      }),
    );
    const viaId = await repository.findById(id);
    const viaEmail = await repository.findByEmail(Email.create(email));
    const viaIdentity = await repository.findByExternalIdentity(
      'GOOGLE',
      'subject-it07',
    );
    const viaAll = (await repository.findAll()).find((u) =>
      u.getId().equals(id),
    );
    for (const user of [saved, viaId, viaEmail, viaIdentity, viaAll]) {
      expect(user.hasExternalIdentity('GOOGLE', 'subject-it07')).toBe(true);
      expect(user.hasLocalPassword()).toBe(false);
      expect(user.getRoles()).toEqual(['CUSTOMER']);
      expect(user.isActive()).toBe(true);
    }
    expect(
      await repository.findByExternalIdentity('GOOGLE', 'nobody'),
    ).toBeNull();
    const reloadedLocal = await repository.findById(local.getId());
    expect(reloadedLocal.getExternalIdentities()).toEqual([]);
    expect(reloadedLocal.getPassword().getHash()).toBe(hash);
  });

  test('IT08 linking an identity to a loaded account persists it once', async () => {
    const created = await repository.save(
      createUser({
        name: 'Will Link',
        email: uniqueEmail('link'),
        passwordHash: hash,
        roles: ['EMPLOYEE'],
      }),
    );
    const loaded = await repository.findById(created.getId());
    loaded.linkExternalIdentity(
      ExternalIdentity.create('GOOGLE', 'subject-it08'),
    );
    const saved = await repository.save(loaded);
    expect(saved.hasExternalIdentity('GOOGLE', 'subject-it08')).toBe(true);
    expect(saved.getRoles()).toEqual(['EMPLOYEE']);
    // Saving the same instance again (no changes) does not insert a duplicate row.
    await repository.save(loaded);
    // A stale aggregate loaded before the link keeps role changes without losing it.
    const stale = await repository.findById(created.getId());
    stale.setRoles(['EMPLOYEE', 'CUSTOMER']);
    await repository.save(stale);
    const { rows } = await database.query(
      'SELECT count(*)::int AS n FROM user_external_identities WHERE user_id = $1',
      [created.getId().getValue()],
    );
    expect(rows[0].n).toBe(1);
    const final = await repository.findByExternalIdentity(
      'GOOGLE',
      'subject-it08',
    );
    expect(final.getRoles().sort()).toEqual(['CUSTOMER', 'EMPLOYEE']);
  });
});
