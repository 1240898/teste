import { PostgresApplicationSessionRepository } from '../../../src/modules/user-authentication-management/infrastructure/persistence/PostgresApplicationSessionRepository.js';
import { jest } from '@jest/globals';

describe('PostgresApplicationSessionRepository', () => {
  test('creates hashed session material with a database-clock inactivity deadline', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'session-id',
            user_id: 'USR-00001',
            created_at: new Date(),
            idle_expires_at: new Date(),
          },
        ],
      }),
    };
    const repository = new PostgresApplicationSessionRepository(database);
    const hash = Buffer.alloc(32, 1);
    const csrfToken = Buffer.alloc(32, 2);
    await repository.create({
      id: 'session-id',
      userId: 'USR-00001',
      hash,
      csrfToken,
      idleSeconds: 600,
    });
    expect(database.query.mock.calls[0][0]).toContain(
      "clock_timestamp() + ($5 * interval '1 second')",
    );
    expect(database.query.mock.calls[0][1]).toEqual([
      'session-id',
      'USR-00001',
      hash,
      csrfToken,
      600,
    ]);
  });

  test('locks and rotates the session row while enforcing its inactivity deadline', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'session-id' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'session-id',
              user_id: 'USR-00001',
              created_at: new Date(),
              idle_expires_at: new Date(),
            },
          ],
        }),
    };
    const database = { withTransaction: async (work) => work(client) };
    const repository = new PostgresApplicationSessionRepository(database);
    const hash = Buffer.alloc(32, 1);
    const csrfToken = Buffer.alloc(32, 2);
    await repository.renew(
      'session-id',
      hash,
      csrfToken,
      {
        id: 'replacement-id',
        hash: Buffer.alloc(32, 3),
        csrfToken: Buffer.alloc(32, 4),
      },
      600,
    );
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[0][0]).toContain(
      'idle_expires_at > clock_timestamp()',
    );
    expect(client.query.mock.calls[1][0]).toContain(
      'idle_expires_at > clock_timestamp()',
    );
    expect(client.query.mock.calls[1][0]).toContain('SET id = $1');
    expect(client.query.mock.calls[1][1][0]).toBe('replacement-id');
  });

  test('revokes all sessions for a user without exposing session material', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new PostgresApplicationSessionRepository(database);
    await repository.revokeAllForUser('USR-00001');
    expect(database.query.mock.calls[0][0]).toContain(
      'UPDATE application_sessions SET revoked_at = clock_timestamp()',
    );
    expect(database.query.mock.calls[0][1]).toEqual(['USR-00001']);
  });
});
