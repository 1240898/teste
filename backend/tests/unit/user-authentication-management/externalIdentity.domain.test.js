import { User } from '../../../src/modules/user-authentication-management/domain/model/User.js';
import {
  Email,
  ExternalIdentity,
  IdentityProvider,
  MarketingConsent,
  UserId,
  UserName,
} from '../../../src/modules/user-authentication-management/domain/model/values.js';
import { createUser } from '../../helpers/createUser.js';

const hash = '$2b$10$' + 'a'.repeat(53);
const google = (subject = '109876543210987654321') =>
  ExternalIdentity.create(IdentityProvider.GOOGLE, subject);
const externalUser = (identity = google()) =>
  User.createFromExternalIdentity(
    UserId.create('USR-00042'),
    UserName.create('Ana Silva'),
    Email.create('ana.silva@gmail.com'),
    identity,
    MarketingConsent.create(false),
  );
const persisted = (overrides = {}) => ({
  id: 'USR-00043',
  name: 'Invited',
  email: 'invited@example.com',
  passwordHash: null,
  externalIdentities: [],
  roles: ['EMPLOYEE'],
  marketingConsent: false,
  consentTimestamp: new Date(),
  active: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AA02 ExternalIdentity value object (UT01)', () => {
  test('accepts a supported provider and the provider subject', () => {
    const linkedAt = new Date('2026-11-02T10:00:00Z');
    const identity = ExternalIdentity.create('GOOGLE', 'abc-123', linkedAt);
    expect(identity.getProvider()).toBe('GOOGLE');
    expect(identity.getSubject()).toBe('abc-123');
    expect(identity.getLinkedAt()).toEqual(linkedAt);
    identity.getLinkedAt().setFullYear(2000);
    expect(identity.getLinkedAt()).toEqual(linkedAt);
    expect(identity.equals(ExternalIdentity.create('GOOGLE', 'abc-123'))).toBe(
      true,
    );
    expect(identity.equals(ExternalIdentity.create('GOOGLE', 'other'))).toBe(
      false,
    );
  });
  test.each([
    ['MICROSOFT', 'abc'],
    ['GOOGLE', ''],
    ['GOOGLE', ' abc'],
    ['GOOGLE', 'x'.repeat(256)],
    ['GOOGLE', 123],
  ])('rejects provider %p with subject %p', (provider, subject) => {
    expect(() => ExternalIdentity.create(provider, subject)).toThrow();
  });
});

describe('AA02 User with external identities', () => {
  test('UT02 first external sign-in creates an active CUSTOMER without password or consent', () => {
    const user = externalUser();
    expect(user.getRoles()).toEqual(['CUSTOMER']);
    expect(user.isActive()).toBe(true);
    expect(user.hasLocalPassword()).toBe(false);
    expect(user.getPassword()).toBeNull();
    expect(user.hasCredential()).toBe(true);
    expect(user.hasActiveRole()).toBe(true);
    expect(user.getMarketingConsent().isGiven()).toBe(false);
    expect(user.hasExternalIdentity('GOOGLE', '109876543210987654321')).toBe(
      true,
    );
    expect(() =>
      User.createFromExternalIdentity(
        UserId.create('USR-00044'),
        UserName.create('Ana'),
        Email.create('ana@gmail.com'),
        google(),
        MarketingConsent.create(true),
      ),
    ).toThrow('External sign-in cannot grant marketing consent');
  });

  test('UT03 one identity per provider; linking never changes roles or active state', () => {
    const user = externalUser();
    expect(() => user.linkExternalIdentity(google('another-subject'))).toThrow(
      'Only one external identity per provider is allowed',
    );
    user.linkExternalIdentity(google());
    expect(user.getExternalIdentities()).toHaveLength(1);

    const local = createUser({
      name: 'Manager',
      email: 'manager@example.com',
      passwordHash: hash,
      roles: ['MANAGER'],
    });
    local.linkExternalIdentity(google('manager-subject'));
    expect(local.getRoles()).toEqual(['MANAGER']);
    expect(local.isActive()).toBe(true);
    expect(local.hasLocalPassword()).toBe(true);
    expect(local.getExternalIdentities()).toHaveLength(1);
    local.getExternalIdentities().pop();
    expect(local.getExternalIdentities()).toHaveLength(1);
  });

  test('UT04 an invited account may exist inactive without credential, but cannot be activated', () => {
    const invited = User.restore(persisted());
    expect(invited.isActive()).toBe(false);
    expect(invited.hasCredential()).toBe(false);
    expect(() => invited.activate()).toThrow(
      'An account without credentials cannot be activated',
    );
    invited.linkExternalIdentity(google('invited-subject'));
    invited.activateByInvitation();
    expect(invited.isActive()).toBe(true);
    expect(invited.getRoles()).toEqual(['EMPLOYEE']);
  });

  test('rehydration enforces the credential invariant for active accounts', () => {
    expect(() => User.restore(persisted({ active: true }))).toThrow(
      'Invalid account state',
    );
    const restored = User.restore(
      persisted({
        active: true,
        externalIdentities: [
          { provider: 'GOOGLE', subject: 's-1', linkedAt: new Date() },
        ],
      }),
    );
    expect(restored.hasExternalIdentity('GOOGLE', 's-1')).toBe(true);
    expect(() =>
      User.restore(
        persisted({
          externalIdentities: [
            { provider: 'GOOGLE', subject: 's-1', linkedAt: new Date() },
            { provider: 'GOOGLE', subject: 's-2', linkedAt: new Date() },
          ],
        }),
      ),
    ).toThrow();
    expect(() =>
      User.restore(persisted({ passwordHash: undefined })),
    ).toThrow();
  });
});
