// Called at runtime: importing the HTTP app does not require database credentials.
export function loadDatabaseConfig(env = process.env) {
  for (const key of ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) {
    if (!env[key]?.trim())
      throw new Error(`Missing required database setting: ${key}`);
  }
  const integer = (key, fallback, max = 2147483647) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > max) {
      throw new Error(`Invalid database setting: ${key}`);
    }
    return value;
  };
  const sslMode = env.PGSSLMODE || 'disable';
  if (!['disable', 'verify-full'].includes(sslMode)) {
    throw new Error('PGSSLMODE must be disable or verify-full');
  }
  if (env.NODE_ENV === 'production' && !env.PGSSLMODE) {
    throw new Error(
      'Production must explicitly set PGSSLMODE to disable (only on an approved isolated network) or verify-full',
    );
  }
  return {
    host: env.PGHOST,
    port: integer('PGPORT', 5432, 65535),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    max: integer('PGPOOL_MAX', 10),
    connectionTimeoutMillis: integer('PGCONNECT_TIMEOUT_MS', 5000),
    idleTimeoutMillis: integer('PGIDLE_TIMEOUT_MS', 30000),
    statement_timeout: integer('PGSTATEMENT_TIMEOUT_MS', 10000),
    application_name: 'laprizza-backend',
    ssl: sslMode === 'verify-full' ? { rejectUnauthorized: true } : false,
  };
}
