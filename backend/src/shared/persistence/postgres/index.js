import pg from 'pg';
import { loadDatabaseConfig } from './config.js';

export function createDatabase(options = loadDatabaseConfig(), Pool = pg.Pool) {
  const pool = new Pool(options);
  // Never log driver messages: they may include infrastructure or credential details.
  pool.on('error', () =>
    console.error('Unexpected idle PostgreSQL connection error'),
  );
  return {
    query: (text, values) => pool.query(text, values),
    async openReadView() {
      const client = await pool.connect();
      let closed = false;
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL statement_timeout = '10s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '70s'");
        // The first query pins the MVCC snapshot before any business read.
        const { rows } = await client.query('SELECT pg_current_snapshot()::text AS revision, now() AS captured_at');
        return {
          revision: rows[0].revision,
          retrievedAt: rows[0].captured_at.toISOString(),
          query: (text, values) => client.query(text, values),
          async close() {
            if (closed) return;
            closed = true;
            try { await client.query('ROLLBACK'); client.release(); }
            catch (error) { client.release(error); }
          },
        };
      } catch (error) {
        client.release(error);
        throw error;
      }
    },
    async verify() {
      const result = await pool.query('SELECT 1 AS connected');
      if (result.rows[0]?.connected !== 1)
        throw new Error('Database verification failed');
    },
    async withTransaction(work) {
      const client = await pool.connect();
      let discard;
      try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          discard = rollbackError;
        }
        throw error;
      } finally {
        client.release(discard);
      }
    },
    close: () => pool.end(),
  };
}
