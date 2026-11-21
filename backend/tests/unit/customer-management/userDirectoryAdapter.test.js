import { UserDirectoryAdapter } from '../../../src/modules/customer-management/infrastructure/persistence/UserDirectoryAdapter.js';
import { jest } from '@jest/globals';

test('looks up a BCK01 business user ID and normalizes its prefix', async () => {
  const database = {
    query: jest.fn().mockResolvedValue({
      rows: [{ email: 'ana@example.com', active: true }],
    }),
  };
  const adapter = new UserDirectoryAdapter(database);

  await expect(adapter.findById(' usr-00001 ')).resolves.toMatchObject({
    email: 'ana@example.com',
    active: true,
  });
  expect(database.query).toHaveBeenCalledWith(
    'SELECT name, email, active, roles FROM users WHERE id = $1',
    ['USR-00001'],
  );
});

test('does not query PostgreSQL for malformed or UUID user identifiers', async () => {
  const database = { query: jest.fn() };
  const adapter = new UserDirectoryAdapter(database);

  await expect(
    adapter.findById('e4b2d3c1-0000-4000-8000-000000000001'),
  ).resolves.toBeNull();
  await expect(adapter.findById('USR-1234')).resolves.toBeNull();
  expect(database.query).not.toHaveBeenCalled();
});
