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
