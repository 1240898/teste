import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const defaultDirectory = new URL('../../../../migrations/', import.meta.url);

const invitationMethodMigration = '0025_activation_invitation_method.sql';
// AA05's audit migration was first released as 0025 on some branches. It is
// now ordered after the existing 0028 migrations; retain the old name as an
// applied-history alias so databases that already ran it do not run it twice.
const legacyMigrationAliases = new Map([
  ['0025_aa05_security_audit_logs.sql', '0029_aa05_security_audit_logs.sql'],
]);
const correctedInvitationMethodChecksum =
  'ffea9c9243455de75ff45fb5a8e790a62dcf13b63b77a2e39163bc59382f0aec';
const originalInvitationMethodChecksums = new Set([
  'b93a66775fbdbe0e960c44dbe8a670ebbff5bbb1bd3c9dcf7f2e4e95aa2836b8',
  '01cef7cb13a561bb14128d42d073cfd3d7b949942acc2c5bc6883ec3c21c05fa',
]);

export function findUnknownAppliedMigrations(applied, available) {
  const availableNames = new Set(available);
  return applied.filter((name) => !availableNames.has(name));
}

function containsTransactionControl(sql) {
  // Ignore comments and quoted bodies: PL/pgSQL functions legitimately contain
  // BEGIN/END blocks, but transaction commands must be owned by the migrator.
  const executableSql = sql
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(
      /\$\$[\s\S]*?\$\$|\$([A-Za-z_][A-Za-z0-9_]*)\$[\s\S]*?\$\1\$/g,
      ' ',
    );
  return /(?:^|;)\s*(?:BEGIN|START\s+TRANSACTION|COMMIT|END(?:\s+TRANSACTION)?|ROLLBACK)\b[^;]*(?:;|$)/im.test(
    executableSql,
  );
}

// SQL migrations are trusted, reviewed source code, never request input.
export async function migrate(
  database,
  directory = defaultDirectory,
  { throughVersion } = {},
) {
  const names = (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (names.some((name) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(name))) {
    throw new Error('Migration names must follow NNNN_description.sql');
  }
  if (new Set(names.map((name) => name.slice(0, 4))).size !== names.length) {
    throw new Error('Migration versions must be unique');
  }
  if (throughVersion && !names.includes(throughVersion)) {
    throw new Error('Migration target is not present in the migration set');
  }
  const migrations = await Promise.all(
    names.map(async (name) => {
      const sql = await readFile(new URL(name, directory), 'utf8');
      if (containsTransactionControl(sql)) {
        throw new Error('Migration SQL must not manage its own transaction');
      }
      return {
        name,
        sql,
        // Git may check out LF migrations as CRLF on Windows. Normalize line
        // endings so the checksum remains stable across operating systems.
        checksum: createHash('sha256')
          .update(sql.replace(/\r\n/g, '\n'))
          .digest('hex'),
        // Accept checksums recorded by older versions of this migrator before
        // line-ending normalization was introduced.
        legacyChecksum: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
  return database.withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(7420401)');
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query(
      'SELECT name, checksum FROM public.schema_migrations ORDER BY name',
    );
    for (const applied of rows) {
      const migration = migrations.find(
        (item) =>
          item.name === applied.name ||
          legacyMigrationAliases.get(applied.name) === item.name,
      );
      if (
        !migration ||
        !(
          [migration.checksum, migration.legacyChecksum].includes(
            applied.checksum,
          ) ||
          (migration.name === invitationMethodMigration &&
            migration.checksum === correctedInvitationMethodChecksum &&
            originalInvitationMethodChecksums.has(applied.checksum))
        )
      ) {
        throw new Error('Applied migration was changed or removed');
      }
    }
    const scheduled = throughVersion
      ? migrations.filter((item) => item.name <= throughVersion)
      : migrations;
    const pending = scheduled.filter(
      (item) =>
        !rows.some(
          (row) =>
            row.name === item.name ||
            legacyMigrationAliases.get(row.name) === item.name,
        ),
    );
    if (pending.some((item) => rows.some((row) => row.name > item.name))) {
      throw new Error('New migrations must follow all applied versions');
    }
    for (const item of pending) {
      await client.query(item.sql);
      await client.query(
        'INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)',
        [item.name, item.checksum],
      );
    }
    return pending.length;
  });
}