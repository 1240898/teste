import { UserResponseDTO } from '../../../src/modules/user-authentication-management/application/dtos/UserResponseDTO.js';
import { AuthTokenDTO } from '../../../src/modules/user-authentication-management/application/dtos/AuthTokenDTO.js';
import { jest } from '@jest/globals';
import { UserService } from '../../../src/modules/user-authentication-management/application/services/UserService.js';
import { User } from '../../../src/modules/user-authentication-management/domain/model/User.js';
import {
  Email,
  UserId,
  UserName,
  Password,
  MarketingConsent,
} from '../../../src/modules/user-authentication-management/domain/model/values.js';
const hash = '$2b$10$' + 'a'.repeat(53);
const account = (id = 'USR-99999') =>
  User.create(
    UserId.create(id),
    UserName.create('Ana'),
    Email.create('ana@example.com'),
    Password.createFromHash(hash),
    MarketingConsent.create(false),
  );
function setup() {
  const user = account();
  const repository = {
    nextId: jest.fn().mockResolvedValue('USR-00001'),
    findByEmail: jest.fn().mockResolvedValue(null),
    existsByEmail: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockImplementation(async (u) => u),
    findById: jest.fn().mockResolvedValue(user),
    updatePasswordIfCurrent: jest.fn().mockResolvedValue(true),
    findAll: jest.fn().mockResolvedValue([user]),
  };
  const hasher = {
    hash: jest.fn().mockResolvedValue(hash),
    compare: jest.fn().mockResolvedValue(true),
  };
  const tokens = {
    generateToken: jest.fn().mockReturnValue('signed-token'),
    verifyToken: jest.fn().mockReturnValue({ sub: user.getId().getValue() }),
    expiresIn: '1d',
  };
  const requestActivationInvitation = jest.fn().mockResolvedValue(undefined);
  return {
    user,
    repository,
    hasher,
    tokens,
    requestActivationInvitation,
    service: new UserService(
      repository,
      hasher,
      tokens,
      requestActivationInvitation,
    ),
  };
}
const manager = { sub: 'USR-99999', roles: ['ADMINISTRATOR'] };
describe('UserService diagram contract', () => {
  test('registration saves an inactive CUSTOMER before requesting an AA06 invitation', async () => {
    const { service, repository, hasher, requestActivationInvitation } =
      setup();
    const result = await service.register({
      name: 'Ana',
      email: ' ANA@example.com ',
      password: 'StrongPass123!',
      roles: ['MANAGER'],
      active: false,
    });
    expect(result).toBeInstanceOf(UserResponseDTO);
    expect(result).toMatchObject({
      email: 'ana@example.com',
      roles: ['CUSTOMER'],
      active: false,
      everActivated: false,
    });
    expect(repository.findByEmail).toHaveBeenCalledWith(
      Email.create('ana@example.com'),
    );
    expect(repository.nextId).toHaveBeenCalledTimes(1);
    expect(requestActivationInvitation).toHaveBeenCalledTimes(1);
    expect(requestActivationInvitation).toHaveBeenCalledWith('USR-00001');
    expect(repository.save.mock.invocationCallOrder[0]).toBeLessThan(
      requestActivationInvitation.mock.invocationCallOrder[0],
    );
    expect(hasher.hash).toHaveBeenCalledWith('StrongPass123!');
    const saved = repository.save.mock.calls[0][0];
    expect(saved).toBeInstanceOf(User);
    expect(saved.getId().getValue()).toBe('USR-00001');
    expect(saved.getPassword().getHash()).toBe(hash);
    expect(JSON.stringify(result)).not.toMatch(/password|hash/i);
  });
  test('duplicate email prevents hashing and persistence', async () => {
    const { service, repository, user, hasher } = setup();
    repository.findByEmail.mockResolvedValue(user);
    await expect(
      service.register({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'StrongPass123!',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
  test.each(['short', 'é'.repeat(37)])(
    'rejects invalid registration password',
    async (password) => {
      const { service, repository } = setup();
      await expect(
        service.register({ name: 'Ana', email: 'ana@example.com', password }),
      ).rejects.toMatchObject({ status: 400 });
      expect(repository.save).not.toHaveBeenCalled();
    },
  );
  test('login signs the diagram payload and projects a safe response', async () => {
    const { service, repository, user, tokens } = setup();
    repository.findByEmail.mockResolvedValue(user);
    const result = await service.login({
      email: 'ANA@example.com',
      password: 'StrongPass123!',
    });
    expect(result).toBeInstanceOf(AuthTokenDTO);
    expect(result.user).toBeInstanceOf(UserResponseDTO);
    expect(tokens.generateToken).toHaveBeenCalledWith({
      sub: user.getId().getValue(),
      email: 'ana@example.com',
      roles: ['CUSTOMER'],
    });
    expect(result).toMatchObject({
      accessToken: 'signed-token',
      tokenType: 'Bearer',
      expiresIn: '1d',
    });
    expect(JSON.stringify(result)).not.toMatch(/password|hash/i);
  });
  test('rejects local login and password change for an external-only account', async () => {
    const { service, repository, hasher, tokens } = setup();
    const externalUser = { getPassword: () => null, isActive: () => true };
    repository.findByEmail.mockResolvedValue(externalUser);
    repository.findById.mockResolvedValue(externalUser);
    hasher.compare.mockResolvedValue(true);

    await expect(
      service.login({ email: 'ana@example.com', password: 'StrongPass123!' }),
    ).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });
    expect(hasher.compare).toHaveBeenCalledTimes(1);
    expect(tokens.generateToken).not.toHaveBeenCalled();

    await expect(
      service.changePassword(
        { sub: 'USR-99999' },
        {
          currentPassword: 'StrongPass123!',
          newPassword: 'DifferentSecure456!',
        },
      ),
    ).rejects.toMatchObject({
      status: 422,
      message: 'This account has no local password',
    });
    expect(repository.updatePasswordIfCurrent).not.toHaveBeenCalled();
  });
  test('changes the authenticated user password after verifying the current password', async () => {
    const { service, repository, user, hasher } = setup();
    const revokeAllForUser = jest.fn();
    service.sessions = { revokeAllForUser };
    const nextPassword = 'DifferentSecure456!';
    const nextHash = '$2b$10$' + 'b'.repeat(53);
    hasher.hash.mockResolvedValue(nextHash);
    hasher.compare.mockImplementation(
      async (plainText) => plainText === 'CurrentSecure123!',
    );
    repository.updatePasswordIfCurrent.mockResolvedValue(true);

    await service.changePassword(
      { sub: 'USR-99999' },
      { currentPassword: 'CurrentSecure123!', newPassword: nextPassword },
    );

    expect(hasher.hash).toHaveBeenCalledWith(nextPassword);
    expect(repository.updatePasswordIfCurrent).toHaveBeenCalledWith(
      UserId.create('USR-99999'),
      hash,
      nextHash,
    );
    expect(user.getPassword().getHash()).toBe(nextHash);
    expect(revokeAllForUser).toHaveBeenCalledWith('USR-99999', undefined);
  });
  test('rejects an incorrect current password and does not update credentials', async () => {
    const { service, repository, hasher } = setup();
    hasher.compare.mockResolvedValue(false);
    await expect(
      service.changePassword(
        { sub: 'USR-99999' },
        {
          currentPassword: 'WrongCurrent123!',
          newPassword: 'DifferentSecure456!',
        },
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repository.updatePasswordIfCurrent).not.toHaveBeenCalled();
  });
  test.each([
    ['same password', 'CurrentSecure123!', 'CurrentSecure123!'],
    ['too similar', 'CurrentSecure123!', 'CurrentSecure124!'],
  ])('rejects a %s', async (_label, currentPassword, newPassword) => {
    const { service, repository, hasher } = setup();
    hasher.compare.mockImplementation(
      async (plainText) => plainText === currentPassword,
    );
    await expect(
      service.changePassword(
        { sub: 'USR-99999' },
        { currentPassword, newPassword },
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(repository.updatePasswordIfCurrent).not.toHaveBeenCalled();
  });
  test('returns conflict when another password change wins the race', async () => {
    const { service, repository, hasher } = setup();
    hasher.compare.mockImplementation(
      async (plainText) => plainText === 'CurrentSecure123!',
    );
    repository.updatePasswordIfCurrent.mockResolvedValue(false);
    await expect(
      service.changePassword(
        { sub: 'USR-99999' },
        {
          currentPassword: 'CurrentSecure123!',
          newPassword: 'DifferentSecure456!',
        },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  // AA03: an inactive account with the CORRECT password gets 403 (see UT08);
  // with a wrong password it keeps the generic AA01 failure.
  test.each(['unknown', 'wrong', 'inactive-wrong-password'])(
    'uniformly rejects %s credentials',
    async (kind) => {
      const { service, repository, user, hasher, tokens } = setup();
      if (kind !== 'unknown') repository.findByEmail.mockResolvedValue(user);
      if (kind !== 'unknown') hasher.compare.mockResolvedValue(false);
      if (kind === 'inactive-wrong-password') user.deactivate();
      await expect(
        service.login({ email: 'ana@example.com', password: 'long-password' }),
      ).rejects.toMatchObject({
        status: 401,
        message: 'Invalid email or password',
      });
      expect(hasher.compare).toHaveBeenCalledTimes(1);
      expect(tokens.generateToken).not.toHaveBeenCalled();
    },
  );
  test('resolves current User state instead of trusting stale JWT roles', async () => {
    const { service, repository, user } = setup();
    expect(await service.resolveActor('token')).toEqual({
      sub: user.getId().getValue(),
      email: 'ana@example.com',
      roles: ['CUSTOMER'],
    });
    expect(repository.findById).toHaveBeenCalledWith(
      UserId.create(user.getId().getValue()),
    );
    user.deactivate();
    await expect(service.resolveActor('token')).rejects.toMatchObject({
      status: 403,
      message: 'Account is not active',
    });
    repository.findById.mockResolvedValue(null);
    await expect(service.resolveActor('token')).rejects.toMatchObject({
      status: 401,
    });
  });
  test('management checks actor permissions before accessing the repository', async () => {
    const { service, user, repository } = setup();
    for (const actor of [undefined, { roles: ['CUSTOMER'] }]) {
      const status = actor ? 403 : 401;
      await expect(service.listUsers(actor)).rejects.toHaveProperty(
        'status',
        status,
      );
      await expect(
        service.getUserById(user.getId().getValue(), actor),
      ).rejects.toHaveProperty('status', status);
      await expect(
        service.updateRoles(
          user.getId().getValue(),
          { roles: ['MANAGER'] },
          actor,
        ),
      ).rejects.toHaveProperty('status', status);
      await expect(
        service.deactivateUser(user.getId().getValue(), actor),
      ).rejects.toHaveProperty('status', status);
    }
    expect(repository.save).not.toHaveBeenCalled();
  });
  test('role changes preserve sessions while deactivation revokes them', async () => {
    const { service, user, repository } = setup();
    user.addRole('ADMINISTRATOR');
    const anotherAdmin = account('USR-99998');
    anotherAdmin.addRole('ADMINISTRATOR');
    repository.findAll.mockResolvedValue([user, anotherAdmin]);
    const revokeAllForUser = jest.fn();
    service.sessions = { revokeAllForUser };
    expect(await service.listUsers(manager)).toHaveLength(2);
    expect(
      (await service.getUserById(user.getId().getValue(), manager)).id,
    ).toBe(user.getId().getValue());
    await service.updateRoles(
      user.getId().getValue(),
      { roles: ['CUSTOMER', 'MANAGER', 'ADMINISTRATOR'] },
      manager,
    );
    expect(user.getRoles()).toEqual(['CUSTOMER', 'MANAGER', 'ADMINISTRATOR']);
    expect(revokeAllForUser).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(user, undefined);
    await service.deactivateUser(user.getId().getValue(), manager);
    expect(user.isActive()).toBe(false);
    expect(revokeAllForUser).toHaveBeenCalledTimes(1);
    expect(revokeAllForUser).toHaveBeenCalledWith('USR-99999', undefined);
    expect(repository.save).toHaveBeenCalledTimes(2);
    repository.findById.mockResolvedValue(null);
    await expect(
      service.getUserById(user.getId().getValue(), manager),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.updateRoles(
        user.getId().getValue(),
        { roles: ['MANAGER'] },
        manager,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.deactivateUser(user.getId().getValue(), manager),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('AA03 internal role resolution', () => {
  const credentials = { email: 'ana@example.com', password: 'StrongPass123!' };

  test('UT06: registration ignores any supplied role and saves only CUSTOMER', async () => {
    const { service, repository } = setup();
    await service.register({ ...credentials, name: 'Ana', roles: ['MANAGER'] });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save.mock.calls[0][0].getRoles()).toEqual(['CUSTOMER']);
  });

  test('UT07: an existing account whose CUSTOMER was revoked is not re-created or changed', async () => {
    const { service, repository, user } = setup();
    user.setRoles(['EMPLOYEE']);
    repository.findByEmail.mockResolvedValue(user);
    await expect(
      service.register({ ...credentials, name: 'Ana' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.save).not.toHaveBeenCalled();
    expect(user.getRoles()).toEqual(['EMPLOYEE']);
  });

  test.each([
    ['inactive', (u) => u.deactivate(), 'Account is not active'],
    [
      'without roles',
      (u) => u.setRoles([]),
      'No active role is assigned to this account',
    ],
  ])(
    'UT08: login with the correct password of an account %s is denied with 403',
    async (_kind, change, message) => {
      const { service, repository, user, tokens } = setup();
      change(user);
      repository.findByEmail.mockResolvedValue(user);
      await expect(service.login(credentials)).rejects.toMatchObject({
        status: 403,
        message,
      });
      expect(tokens.generateToken).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
      expect(user.isActive()).toBe(message !== 'Account is not active');
    },
  );

  test('UT08: login keeps the current roles (revoked CUSTOMER is not restored) and never saves', async () => {
    const { service, repository, user, tokens } = setup();
    user.setRoles(['EMPLOYEE']);
    repository.findByEmail.mockResolvedValue(user);
    const result = await service.login(credentials);
    expect(result.user.roles).toEqual(['EMPLOYEE']);
    expect(tokens.generateToken).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['EMPLOYEE'] }),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  test('UT10: resolveActor ignores the roles claim of the token', async () => {
    const { service, tokens, user } = setup();
    tokens.verifyToken.mockReturnValue({
      sub: user.getId().getValue(),
      roles: ['ADMINISTRATOR'],
    });
    expect((await service.resolveActor('token')).roles).toEqual(['CUSTOMER']);
  });

  test('UT11: resolveActor denies role-less accounts and propagates repository failures', async () => {
    const { service, repository, user } = setup();
    user.setRoles([]);
    await expect(service.resolveActor('token')).rejects.toMatchObject({
      status: 403,
      message: 'No active role is assigned to this account',
    });
    const failure = new Error('connection lost');
    repository.findById.mockRejectedValue(failure);
    await expect(service.resolveActor('token')).rejects.toBe(failure);
  });

  test('UT11b: getCurrentUser re-validates the reloaded account', async () => {
    const { service, repository, user } = setup();
    const actor = await service.resolveActor('token');
    expect(await service.getCurrentUser(actor)).toMatchObject({
      id: user.getId().getValue(),
      roles: ['CUSTOMER'],
      active: true,
    });
    user.setRoles([]);
    await expect(service.getCurrentUser(actor)).rejects.toMatchObject({
      status: 403,
      message: 'No active role is assigned to this account',
    });
    user.setRoles(['CUSTOMER']);
    user.deactivate();
    await expect(service.getCurrentUser(actor)).rejects.toMatchObject({
      status: 403,
      message: 'Account is not active',
    });
    repository.findById.mockResolvedValue(null);
    await expect(service.getCurrentUser(actor)).rejects.toMatchObject({
      status: 401,
      message: 'Invalid or expired token',
    });
    await expect(service.getCurrentUser(undefined)).rejects.toMatchObject({
      status: 401,
    });
  });
});
