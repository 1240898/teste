import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../src/shared/persistence/postgres/index.js';

// Every suite owns a schema, including its migration ledger. Never drops public tables.
export async function isolatedDatabase() {
  if (!process.env.PGDATABASE?.endsWith('_test'))
    throw new Error('Use a dedicated PGDATABASE ending in _test');
  const connection = createDatabase();
  const schema = 'test_' + randomUUID().replaceAll('-', '');
  await connection.query(`CREATE SCHEMA "${schema}"`);
  const withTransaction = (work) =>
    connection.withTransaction(async (client) => {
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      return work({
        query: (sql, values) =>
          client.query(
            sql.replaceAll(
              'public.schema_migrations',
              `"${schema}".schema_migrations`,
            ),
            values,
          ),
      });
    });
  return {
    query: (sql, values) =>
      withTransaction((client) => client.query(sql, values)),
    withTransaction,
    verify: () => connection.verify(),
    async close() {
      try {
        await connection.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await connection.close();
      }
    },
  };
}
