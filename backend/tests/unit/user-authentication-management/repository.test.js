import { jest } from '@jest/globals';
import { UserId } from '../../../src/modules/user-authentication-management/domain/model/values.js';
import { UserRepository } from '../../../src/modules/user-authentication-management/infrastructure/persistence/UserRepository.js';

describe('UserRepository password update', () => {
  test('updates the password only when the previously checked hash is still current and account is active', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 'USR-00001' }] }),
    };
    const repository = new UserRepository(database);

    await expect(
      repository.updatePasswordIfCurrent(
        UserId.create('USR-00001'),
        'old-hash',
        'new-hash',
      ),
    ).resolves.toBe(true);

    const [sql, parameters] = database.query.mock.calls[0];
    expect(sql).toContain(
      'WHERE id = $1 AND password_hash = $2 AND active = true',
    );
    expect(sql).toContain('SET password_hash = $3, updated_at = now()');
    expect(parameters).toEqual(['USR-00001', 'old-hash', 'new-hash']);
  });

  test('reports false when the account or expected password hash no longer matches', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new UserRepository(database);

    await expect(
      repository.updatePasswordIfCurrent(
        UserId.create('USR-00001'),
        'stale-hash',
        'new-hash',
      ),
    ).resolves.toBe(false);
  });
});
