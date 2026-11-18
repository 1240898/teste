import { User } from '../../../src/modules/user-authentication-management/domain/model/User.js';
import {
  Email,
  UserId,
  UserName,
  Password,
  MarketingConsent,
  normalizeRoles,
} from '../../../src/modules/user-authentication-management/domain/model/values.js';
import { createUser } from '../../helpers/createUser.js';
import { UserMapper } from '../../../src/modules/user-authentication-management/infrastructure/persistence/UserMapper.js';
const hash = '$2b$10$' + 'a'.repeat(53);
const input = () => ({
  name: 'Ana Silva',
  email: ' ANA@example.com ',
  passwordHash: hash,
  roles: ['CUSTOMER'],
  marketingConsent: false,
});
describe('User and value object diagram contracts', () => {
  test('uses the specified factories, getters and immutable values', () => {
    const user = User.create(
      UserId.create('USR-00001'),
      UserName.create('Ana Silva'),
      Email.create(' ANA@example.com '),
      Password.createFromHash(hash),
      MarketingConsent.create(false),
    );
    expect(user.getEmail().getValue()).toBe('ana@example.com');
    expect(user.getName().getValue()).toBe('Ana Silva');
    expect(Email.create('ANA@example.com').equals(user.getEmail())).toBe(true);
    expect(UserId.create(user.getId().getValue()).equals(user.getId())).toBe(
      true,
    );
    expect(user.getPassword().getHash()).toBe(hash);
    expect(user.isActive()).toBe(true);
    expect(user.hasRole('CUSTOMER')).toBe(true);
    expect(user.getMarketingConsent().isGiven()).toBe(false);
    expect(user.getMarketingConsent().getTimestamp()).toBeInstanceOf(Date);
    expect(JSON.stringify(user)).not.toContain(hash);
    expect(JSON.stringify(user.getPassword())).toBeUndefined();
  });
  test.each(['', ' ', null, 'a'.repeat(101)])(
    'rejects invalid name %p',
    (name) => {
      expect(() => UserName.create(name)).toThrow();
    },
  );
  test.each(['', 'bad', null])('rejects invalid email %p', (email) => {
    expect(() => Email.create(email)).toThrow();
  });
  test('validates identifiers, hashes and consent', () => {
    expect(UserId.create('usr-00001').getValue()).toBe('USR-00001');
    expect(() => UserId.create('not-a-user-id')).toThrow();
    expect(() =>
      UserId.create('e4b2d3c1-0000-4000-8000-000000000001'),
    ).toThrow();
    expect(() => UserId.create('USR-1234')).toThrow();
    expect(() => UserId.create('USR-ABCDE')).toThrow();
    expect(() => Password.createFromHash('plaintext')).toThrow();
    expect(() => Password.createFromHash('$2b$99$' + 'a'.repeat(53))).toThrow();
    expect(() => MarketingConsent.create('true')).toThrow();
    expect(() => MarketingConsent.create(true, new Date('invalid'))).toThrow();
  });
  test.each([['ADMIN'], ['ROOT'], ['CUSTOMER', null], 'MANAGER', null])(
    'rejects invalid roles %p',
    (roles) => {
      expect(() => normalizeRoles(roles)).toThrow();
    },
  );
  test('add/remove/set roles preserve cardinality without leaking mutable state', () => {
    const user = createUser(input());
    user.addRole('MANAGER');
    user.addRole('MANAGER');
    expect(user.getRoles()).toEqual(['CUSTOMER', 'MANAGER']);
    user.getRoles().pop();
    expect(user.hasRole('MANAGER')).toBe(true);
    user.removeRole('CUSTOMER');
    expect(user.getRoles()).toEqual(['MANAGER']);
    expect(() => user.addRole('ADMIN')).toThrow();
    expect(user.getRoles()).toEqual(['MANAGER']);
    // AA03: roles are 0..*; the last role may be removed.
    user.removeRole('MANAGER');
    expect(user.getRoles()).toEqual([]);
  });
  describe('AA03 internal role model', () => {
    test('UT01: User.create takes no roles and always assigns CUSTOMER', () => {
      const user = createUser({ ...input(), roles: undefined });
      expect(user.getRoles()).toEqual(['CUSTOMER']);
      expect(user.isActive()).toBe(true);
      expect(User.create.length).toBe(5);
    });
    test('UT03: normalizeRoles accepts 0..* known roles including ADMINISTRATOR', () => {
      expect(normalizeRoles([])).toEqual([]);
      expect(normalizeRoles(['ADMINISTRATOR', 'MANAGER', 'MANAGER'])).toEqual([
        'ADMINISTRATOR',
        'MANAGER',
      ]);
      expect(() => normalizeRoles(['ROOT'])).toThrow();
    });
    test('UT04: hasActiveRole / canAccess combine active state and roles', () => {
      const user = createUser(input());
      expect([user.hasActiveRole(), user.canAccess()]).toEqual([true, true]);
      user.setRoles([]);
      expect([user.hasActiveRole(), user.canAccess()]).toEqual([false, false]);
      user.setRoles(['EMPLOYEE']);
      user.deactivate();
      expect([user.hasActiveRole(), user.canAccess()]).toEqual([true, false]);
    });
    test('UT05: restore rejects unknown persisted roles; the mapper reports a 500', () => {
      const row = {
        id: 'USR-00001',
        name: 'Ana',
        email: 'ana@example.com',
        password_hash: hash,
        roles: ['ROOT'],
        active: true,
        marketing_consent_given: false,
        marketing_consent_timestamp: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
      expect(() =>
        User.restore({
          ...row,
          passwordHash: hash,
          consentTimestamp: row.marketing_consent_timestamp,
          marketingConsent: false,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
      ).toThrow();
      expect(() => UserMapper.toDomain(row)).toThrow(
        expect.objectContaining({
          status: 500,
          message: 'Invalid persisted account',
        }),
      );
      expect(UserMapper.toDomain({ ...row, roles: [] }).getRoles()).toEqual([]);
    });
  });
  test('activation and consent changes preserve identity and defensive timestamps', () => {
    const user = createUser(input());
    const identity = user.getId().getValue();
    user.deactivate();
    const deactivated = user.updatedAt;
    user.deactivate();
    expect(user.updatedAt).toEqual(deactivated);
    expect(user.isActive()).toBe(false);
    user.activate();
    expect(user.isActive()).toBe(true);
    const now = new Date();
    const consent = MarketingConsent.create(true, now);
    user.updateMarketingConsent(consent);
    now.setFullYear(2000);
    expect(user.getMarketingConsent().isGiven()).toBe(true);
    expect(user.getMarketingConsent().getTimestamp().getFullYear()).not.toBe(
      2000,
    );
    expect(() => user.updateMarketingConsent({ consentGiven: true })).toThrow();
    expect(user.getId().getValue()).toBe(identity);
  });
  test('changes the stored credential through the User aggregate', () => {
    const user = createUser(input());
    const replacement = '$2b$10$' + 'b'.repeat(53);
    const before = user.updatedAt;
    user.changePassword(Password.createFromHash(replacement));
    expect(user.getPassword().getHash()).toBe(replacement);
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(() => user.changePassword({ hash: replacement })).toThrow();
  });
  test('rehydration preserves stored state and refuses incomplete records', () => {
    const user = createUser(input());
    const data = {
      ...input(),
      id: user.getId().getValue(),
      active: false,
      consentTimestamp: user.getMarketingConsent().getTimestamp(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    const restored = User.restore(data);
    expect(restored.getId().equals(user.getId())).toBe(true);
    expect(restored.createdAt).toEqual(user.createdAt);
    const date = restored.createdAt;
    date.setFullYear(2000);
    expect(restored.createdAt).toEqual(user.createdAt);
    expect(() => User.restore({ ...data, active: 'false' })).toThrow();
    expect(() => User.restore({ ...data, id: undefined })).toThrow();
    expect(() => User.restore({ ...data, marketingConsent: null })).toThrow();
    expect(() =>
      User.restore({ ...data, consentTimestamp: undefined }),
    ).toThrow();
  });
});
