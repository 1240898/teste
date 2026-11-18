import { jest } from '@jest/globals';
import { bootstrapManager } from '../../../src/modules/user-authentication-management/infrastructure/bootstrapManager.js';
import { bootstrapAdministrator } from '../../../src/modules/user-authentication-management/infrastructure/bootstrapAdministrator.js';
import { Email } from '../../../src/modules/user-authentication-management/domain/model/values.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
const hash = '$2b$10$' + 'a'.repeat(53);
test('bootstrap refuses an existing Manager without hashing or inserting', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [{ exists: true }] });
  const hasher = { hash: jest.fn() };
  const database = { withTransaction: (work) => work({ query }) };
  await expect(
    bootstrapManager(
      database,
      {
        name: 'Manager',
        email: 'manager@example.com',
        password: 'StrongPass123!',
      },
      hasher,
    ),
  ).rejects.toThrow('already exists');
  expect(hasher.hash).not.toHaveBeenCalled();
});
test('bootstrap requires explicit valid credentials', async () => {
  const database = {
    withTransaction: () => {
      throw new Error('must validate first');
    },
  };
  await expect(
    bootstrapManager(database, {
      name: 'Manager',
      email: 'bad',
      password: 'StrongPass123!',
    }),
  ).rejects.toThrow('email');
});
test('bootstrap uses a transaction and creates only a MANAGER account', async () => {
  const repository = new MemoryUserRepository();
  const calls = [];
  const client = {
    query: async (sql) => {
      calls.push(sql);
      return { rows: [{ exists: false }] };
    },
  };
  const result = await bootstrapManager(
    { withTransaction: (work) => work(client) },
    {
      name: 'Manager',
      email: 'MANAGER@example.com',
      password: 'StrongPass123!',
    },
    { hash: async () => hash },
    () => repository,
  );
  expect(result.roles).toEqual(['CUSTOMER', 'MANAGER']);
  expect(calls[0]).toContain('pg_advisory_xact_lock');
  expect(
    (
      await repository.findByEmail(Email.create('manager@example.com'))
    ).getRoles(),
  ).toEqual(['CUSTOMER', 'MANAGER']);
  expect(JSON.stringify(result)).not.toContain('password');
});

test('initialization bootstrap provisions one Administrator and audits its assignment', async () => {
  const repository = new MemoryUserRepository();
  const queries = [];
  const client = {
    query: async (sql) => {
      queries.push(sql);
      return { rows: [{ exists: false }] };
    },
  };
  const result = await bootstrapAdministrator(
    { withTransaction: (work) => work(client) },
    { name: 'Admin', email: 'admin@example.com', password: 'StrongPass123!' },
    { hash: async () => hash },
    () => repository,
  );
  expect(result.roles).toEqual(['CUSTOMER', 'ADMINISTRATOR']);
  expect(
    queries.some((sql) => sql.includes('INSERT INTO role_change_records')),
  ).toBe(true);
});
