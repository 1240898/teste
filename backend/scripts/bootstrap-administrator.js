import '../src/shared/config/index.js';
import { AppError } from '../src/shared/errors/AppError.js';
import { createDatabase } from '../src/shared/persistence/postgres/index.js';
import { bootstrapAdministrator } from '../src/modules/user-authentication-management/infrastructure/bootstrapAdministrator.js';

let database;
try {
  const required = ['NAME', 'EMAIL', 'PASSWORD'].map(
    (field) => `BOOTSTRAP_ADMINISTRATOR_${field}`,
  );
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length)
    throw new AppError(`Missing settings: ${missing.join(', ')}`, 400);

  const input = {
    name: process.env.BOOTSTRAP_ADMINISTRATOR_NAME,
    email: process.env.BOOTSTRAP_ADMINISTRATOR_EMAIL,
    password: process.env.BOOTSTRAP_ADMINISTRATOR_PASSWORD,
  };
  database = createDatabase();
  await bootstrapAdministrator(database, input);
  console.log(
    'Initial Administrator created. Remove bootstrap credentials from the environment.',
  );
} catch (error) {
  let reason = 'Check database configuration, migrations and availability.';
  if (
    (error instanceof AppError && error.status < 500) ||
    error.message === 'An active Administrator already exists'
  ) {
    reason = error.message;
  } else if (/^[A-Z0-9]{5}$/.test(error.code ?? '')) {
    reason = `PostgreSQL reported error ${error.code}.`;
  }
  console.error(`Administrator bootstrap failed. ${reason}`);
  process.exitCode = 1;
} finally {
  await database?.close();
}
