import '../../src/shared/config/index.js';
import { mkdtemp, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isolatedDatabase } from '../helpers/isolatedDatabase.js';
import { migrate } from '../../src/shared/persistence/postgres/migrate.js';

const describeDatabase =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
describeDatabase(
  'PostgreSQL infrastructure (dedicated test database only)',
  () => {
    let database;
    let directory;
    beforeAll(async () => {
      if (!process.env.PGDATABASE?.endsWith('_test'))
        throw new Error('Use a dedicated PGDATABASE ending in _test');
      database = await isolatedDatabase();
      directory = await mkdtemp(join(tmpdir(), 'laprizza-migrations-'));
    });
    afterAll(async () => {
      await database?.close();
      if (directory) await rm(directory, { recursive: true, force: true });
    });
    test('connects and rolls back without business tables', async () => {
      await database.verify();
      await expect(
        database.withTransaction(async (client) => {
          await client.query('CREATE TEMP TABLE arc04_probe (value integer)');
          await client.query('INSERT INTO arc04_probe VALUES (1)');
          throw new Error('intentional rollback');
        }),
      ).rejects.toThrow('intentional rollback');
      const { rows } = await database.query(
        "SELECT to_regclass('pg_temp.arc04_probe') AS probe",
      );
      expect(rows[0].probe).toBeNull();
    });
    test('replays migrations safely, rejects edits and rolls back invalid SQL', async () => {
      const directoryUrl = pathToFileURL(directory + '/');
      await database.query('DROP TABLE IF EXISTS public.schema_migrations');
      try {
        await writeFile(join(directory, '0001_probe.sql'), 'SELECT 1;');
        expect(await migrate(database, directoryUrl)).toBe(1);
        expect(await migrate(database, directoryUrl)).toBe(0);
        await writeFile(join(directory, '0001_probe.sql'), 'SELECT 2;');
        await expect(migrate(database, directoryUrl)).rejects.toThrow(
          'changed or removed',
        );
        await writeFile(join(directory, '0001_probe.sql'), 'SELECT 1;');
        await writeFile(join(directory, '0002_invalid.sql'), 'INVALID SQL;');
        await expect(migrate(database, directoryUrl)).rejects.toThrow();
        const { rows } = await database.query(
          'SELECT count(*)::int AS count FROM public.schema_migrations',
        );
        expect(rows[0].count).toBe(1);
      } finally {
        await database.query('DROP TABLE IF EXISTS public.schema_migrations');
      }
    });

    test('can build an exact schema baseline before a later rehearsal migration', async () => {
      const rehearsalDirectory = await mkdtemp(
        join(tmpdir(), 'laprizza-rehearsal-migrations-'),
      );
      const directoryUrl = pathToFileURL(rehearsalDirectory + '/');
      await database.query('DROP TABLE IF EXISTS public.schema_migrations');
      try {
        await writeFile(
          join(rehearsalDirectory, '0001_baseline.sql'),
          'CREATE TABLE public.rehearsal_baseline (id integer PRIMARY KEY);',
        );
        await writeFile(
          join(rehearsalDirectory, '0002_candidate.sql'),
          'CREATE TABLE public.rehearsal_candidate (id integer PRIMARY KEY);',
        );
        expect(
          await migrate(database, directoryUrl, {
            throughVersion: '0001_baseline.sql',
          }),
        ).toBe(1);
        const { rows: baseline } = await database.query(
          'SELECT to_regclass(\'public.rehearsal_baseline\') AS baseline, to_regclass(\'public.rehearsal_candidate\') AS candidate',
        );
        expect(baseline[0]).toEqual({
          baseline: 'public.rehearsal_baseline',
          candidate: null,
        });
        expect(await migrate(database, directoryUrl)).toBe(1);
      } finally {
        await database.query(
          'DROP TABLE IF EXISTS public.rehearsal_candidate, public.rehearsal_baseline, public.schema_migrations',
        );
        await rm(rehearsalDirectory, { recursive: true, force: true });
      }
    });

    test('preserves durable activation history and keeps unsupported legacy accounts pending', async () => {
      const legacyDatabase = await isolatedDatabase();
      const migrationDirectory = await mkdtemp(
        join(tmpdir(), 'laprizza-legacy-activation-'),
      );
      try {
        const source = new URL('../../migrations/', import.meta.url);
        const migrationNames = (await readdir(source))
          .filter((name) => name.endsWith('.sql'))
          .sort();
        const directoryUrl = pathToFileURL(migrationDirectory + '/');
        for (const name of migrationNames.filter((item) => item < '0023_'))
          await copyFile(new URL(name, source), join(migrationDirectory, name));
        await migrate(legacyDatabase, directoryUrl);

        const now = new Date();
        const passwordHash = '$2b$10$' + 'a'.repeat(53);
        for (const [id, email, active] of [
          ['USR-90001', 'active@example.test', true],
          ['USR-90002', 'previously-active@example.test', false],
          ['USR-90003', 'previously-active-no-session@example.test', false],
          ['USR-90004', 'pending@example.test', false],
        ]) {
          await legacyDatabase.query(
            `INSERT INTO users (
              id, name, email, password_hash, roles, active,
              marketing_consent_given, marketing_consent_timestamp,
              created_at, updated_at
            ) VALUES ($1, 'Legacy User', $2, $3, ARRAY['CUSTOMER'], $4,
              false, $5, $5, $5)`,
            [id, email, passwordHash, active, now],
          );
        }

        // A previous deactivation or other post-creation change leaves a
        // durable updated_at signal even after old sessions have been purged.
        await legacyDatabase.query(
          `UPDATE users SET updated_at = $2 WHERE id = $1`,
          ['USR-90003', new Date(now.getTime() + 60_000)],
        );

        // A persisted session is reliable evidence that this inactive account
        // authenticated before the AA06 activation state was introduced.
        await legacyDatabase.query(
          `INSERT INTO application_sessions (
            id, user_id, credential_hash, csrf_token, created_at,
            last_activity_at, idle_expires_at, revoked_at
          ) VALUES (
            '90000000-0000-4000-8000-000000000002', 'USR-90002',
            decode(repeat('01', 32), 'hex'), decode(repeat('02', 32), 'hex'),
            $1::timestamptz, $1::timestamptz,
            $1::timestamptz + interval '1 hour', $1::timestamptz
          )`,
          [now],
        );

        for (const name of migrationNames.filter((item) => item >= '0023_'))
          await copyFile(new URL(name, source), join(migrationDirectory, name));
        await migrate(legacyDatabase, directoryUrl);

        const { rows } = await legacyDatabase.query(
          'SELECT id, ever_activated FROM users ORDER BY id',
        );
        expect(rows).toEqual([
          { id: 'USR-90001', ever_activated: true },
          { id: 'USR-90002', ever_activated: true },
          { id: 'USR-90003', ever_activated: true },
          { id: 'USR-90004', ever_activated: false },
        ]);
        const { rows: defaults } = await legacyDatabase.query(
          `SELECT column_default FROM information_schema.columns
           WHERE table_schema = current_schema() AND table_name = 'users'
             AND column_name = 'ever_activated'`,
        );
        expect(defaults[0].column_default).toBe('false');
      } finally {
        await legacyDatabase.close();
        await rm(migrationDirectory, { recursive: true, force: true });
      }
    });
  },
);
