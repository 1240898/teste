import { jest } from '@jest/globals';
import { loadDatabaseConfig } from '../../src/shared/persistence/postgres/config.js';
import { createDatabase } from '../../src/shared/persistence/postgres/index.js';
import { findUnknownAppliedMigrations } from '../../src/shared/persistence/postgres/migrate.js';

const env = {
  PGHOST: 'localhost',
  PGDATABASE: 'test',
  PGUSER: 'test',
  PGPASSWORD: 'test-only',
};

test('validates required configuration and bounded integers', () => {
  expect(loadDatabaseConfig(env).port).toBe(5432);
  for (const key of ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) {
    expect(() => loadDatabaseConfig({ ...env, [key]: '' })).toThrow(key);
  }
  for (const value of ['abc', '0', '-1', '1.5', '65536']) {
    expect(() => loadDatabaseConfig({ ...env, PGPORT: value })).toThrow(
      'PGPORT',
    );
  }
  expect(() => loadDatabaseConfig({ ...env, NODE_ENV: 'production' })).toThrow(
    'verify-full',
  );
  expect(() => loadDatabaseConfig({ ...env, PGSSLMODE: 'require' })).toThrow(
    'PGSSLMODE',
  );
  expect(
    loadDatabaseConfig({
      ...env,
      NODE_ENV: 'production',
      PGSSLMODE: 'verify-full',
    }).ssl.rejectUnauthorized,
  ).toBe(true);
});

test('detects database migrations missing from the candidate image', () => {
  expect(
    findUnknownAppliedMigrations(
      ['0027_known_migration.sql', '0028_newer_migration.sql'],
      ['0027_known_migration.sql'],
    ),
  ).toEqual(['0028_newer_migration.sql']);
  expect(
    findUnknownAppliedMigrations(['0027_known_migration.sql'], [
      '0027_known_migration.sql',
      '0028_candidate_migration.sql',
    ]),
  ).toEqual([]);
});

function fixture() {
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
  const pool = {
    on: jest.fn(),
    query: jest.fn().mockResolvedValue({ rows: [{ connected: 1 }] }),
    connect: jest.fn().mockResolvedValue(client),
    end: jest.fn(),
  };
  const database = createDatabase({}, function () {
    return pool;
  });
  return { client, pool, database };
}

test('commits on the same client and releases it', async () => {
  const { client, database } = fixture();
  await expect(
    database.withTransaction(async (connection) => {
      expect(connection).toBe(client);
      await connection.query('SELECT 42');
      return 42;
    }),
  ).resolves.toBe(42);
  expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
    'BEGIN',
    'SELECT 42',
    'COMMIT',
  ]);
  expect(client.release).toHaveBeenCalledWith(undefined);
});

test('rolls back failed work and preserves the original error', async () => {
  const { client, database } = fixture();
  const error = new Error('failed work');
  await expect(
    database.withTransaction(async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
    'BEGIN',
    'ROLLBACK',
  ]);
  expect(client.release).toHaveBeenCalled();
});

test('discards a client when rollback fails', async () => {
  const { client, database } = fixture();
  const rollback = new Error('connection lost');
  client.query.mockResolvedValueOnce({}).mockRejectedValueOnce(rollback);
  const original = new Error('work failed');
  await expect(
    database.withTransaction(async () => {
      throw original;
    }),
  ).rejects.toBe(original);
  expect(client.release).toHaveBeenCalledWith(rollback);
});

test('handles failed commit with rollback', async () => {
  const { client, database } = fixture();
  client.query
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error('commit failed'))
    .mockResolvedValueOnce({});
  await expect(database.withTransaction(async () => 1)).rejects.toThrow(
    'commit failed',
  );
  expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
  ]);
  expect(client.release).toHaveBeenCalled();
});

test('verifies connectivity and closes the pool', async () => {
  const { database, pool } = fixture();
  await database.verify();
  pool.query.mockResolvedValueOnce({ rows: [] });
  await expect(database.verify()).rejects.toThrow('verification');
  await database.close();
  expect(pool.end).toHaveBeenCalled();
});
