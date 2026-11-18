import '../src/shared/config/index.js';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createDatabase } from '../src/shared/persistence/postgres/index.js';
import { loadDatabaseConfig } from '../src/shared/persistence/postgres/config.js';
import { migrate } from '../src/shared/persistence/postgres/migrate.js';
import { bootstrapAdministrator } from '../src/modules/user-authentication-management/infrastructure/bootstrapAdministrator.js';
import { resetConfirmation } from './reset-target.js';

let database;
let prompt;
try {
  const options = loadDatabaseConfig();
  if (process.argv.slice(2).some((arg) => arg !== '--dei')) {
    throw new Error('Unknown reset argument.');
  }
  const expected = resetConfirmation(
    options,
    process.env.NODE_ENV,
    process.argv.includes('--dei'),
  );
  const administrator = {
    name: process.env.BOOTSTRAP_ADMINISTRATOR_NAME,
    email: process.env.BOOTSTRAP_ADMINISTRATOR_EMAIL,
    password: process.env.BOOTSTRAP_ADMINISTRATOR_PASSWORD,
  };
  if (Object.values(administrator).some((value) => !value?.trim())) {
    throw new Error(
      'Set BOOTSTRAP_ADMINISTRATOR_NAME, BOOTSTRAP_ADMINISTRATOR_EMAIL and BOOTSTRAP_ADMINISTRATOR_PASSWORD in backend/.env before resetting.',
    );
  }
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('Run this command in an interactive terminal.');
  }
  console.log(
    `This deletes the entire public schema in ${options.database} on ${options.host}:${options.port}, including all users, and recreates the initial data and Administrator.`,
  );
  console.log('Stop the backend and any collection runs before continuing.');
  prompt = createInterface({ input: stdin, output: stdout });
  const confirmation = await prompt.question(`Type ${expected} to reset: `);
  prompt.close();
  prompt = undefined;
  if (confirmation !== expected) {
    console.log('Reset cancelled.');
  } else {
    database = createDatabase(options);
    const count = await database.withTransaction(async (client) => {
      // Both helpers use this same transaction so failures restore the old schema.
      const transaction = {
        query: (text, values) => client.query(text, values),
        withTransaction: (work) => work(client),
      };
      await client.query('SELECT pg_advisory_xact_lock(7420401)');
      await client.query('DROP SCHEMA public CASCADE');
      await client.query('CREATE SCHEMA public');
      const applied = await migrate(transaction);
      await bootstrapAdministrator(transaction, administrator);
      return applied;
    });
    console.log(
      `Database reset complete. Applied ${count} migration(s) and created the Administrator.`,
    );
    console.log(
      'Start the backend, then log in again in Postman to obtain a new token.',
    );
  }
} catch (error) {
  // Driver errors can contain credentials or infrastructure details.
  if (!database) console.error(error.message);
  else
    console.error(
      'Reset failed and was rolled back. Check database access, migrations and Manager settings.',
    );
  process.exitCode = 1;
} finally {
  prompt?.close();
  await database?.close();
}
