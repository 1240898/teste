import '../src/shared/config/index.js';
import { readdir } from 'node:fs/promises';
import { createDatabase } from '../src/shared/persistence/postgres/index.js';
import {
  findUnknownAppliedMigrations,
  migrate,
} from '../src/shared/persistence/postgres/migrate.js';

let database;
try {
  const command = process.argv[2];
  if (!['check', 'migrate', 'state'].includes(command))
    throw new Error('Unknown database command');
  let migrationOptions;
  if (command === 'migrate' && process.argv.length > 3) {
    if (
      process.argv.length !== 5 ||
      process.argv[3] !== '--through' ||
      !/^\d{4}_[a-z0-9_]+\.sql$/.test(process.argv[4])
    )
      throw new Error('Invalid migration rehearsal target');
    migrationOptions = { throughVersion: process.argv[4] };
  }
  database = createDatabase();
  await database.verify();
  if (command === 'migrate') {
    console.log(
      `Applied ${await migrate(database, undefined, migrationOptions)} migration(s)`,
    );
  } else if (command === 'state') {
    const directory = new URL('../migrations/', import.meta.url);
    const available = (await readdir(directory))
      .filter((name) => name.endsWith('.sql'))
      .sort();
    const { rows: ledger } = await database.query(
      `SELECT to_regclass('public.schema_migrations') AS ledger`,
    );
    const { rows: publicTables } = await database.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS has_tables",
    );
    let applied = [];
    if (ledger[0]?.ledger) {
      const { rows } = await database.query(
        'SELECT name FROM public.schema_migrations ORDER BY name',
      );
      applied = rows.map((row) => row.name);
    }
    console.log(
      JSON.stringify({
        current_version: applied.at(-1) ?? 'none',
        target_version: available.at(-1) ?? 'none',
        pending: available.filter((name) => !applied.includes(name)),
        unknown_applied: findUnknownAppliedMigrations(applied, available),
        empty_database: !ledger[0]?.ledger && !publicTables[0]?.has_tables,
      }),
    );
  } else {
    console.log('PostgreSQL connectivity: OK');
  }
} catch (error) {
  const code = /^[A-Z0-9_]{1,32}$/.test(error?.code ?? '')
    ? ` (code=${error.code})`
    : '';
  console.error(
    `Database command failed. Check configuration, connectivity and migration files.${code}`,
  );
  process.exitCode = 1;
} finally {
  await database?.close();
}
