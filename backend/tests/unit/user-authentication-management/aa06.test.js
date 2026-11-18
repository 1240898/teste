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
import { RoleChangeRecord } from '../../../src/modules/user-authentication-management/domain/model/RoleChangeRecord.js';

const hash = '$2b$10$' + 'a'.repeat(53);
function makeUser(id, roles = ['CUSTOMER']) {
  const result = User.create(
    UserId.create(id),
    UserName.create('Test User'),
    Email.create(`${id.toLowerCase()}@example.com`),
    Password.createFromHash(hash),
    MarketingConsent.create(false),
  );
  result.setRoles(roles);
  return result;
}

function serviceFor({
  admin,
  target = admin,
  databaseQuery = jest.fn().mockResolvedValue({ rows: [{ count: 1 }] }),
  delivery = { sendInvitation: jest.fn().mockResolvedValue(undefined) },
} = {}) {
  const repository = {
    findById: jest.fn(async (id) =>
      id.getValue() === admin.getId().getValue() ? admin : target,
    ),
    save: jest.fn(async (current) => current),
    findAll: jest.fn().mockResolvedValue([admin, target]),
  };
  const roleChangeRepository = { save: jest.fn().mockResolvedValue(undefined) };
  const invitationRepository = {
    replacePending: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork = {
    withTransaction: (work) => work({ query: databaseQuery }),
  };
  const service = new UserService(
    repository,
    {},
    {},
    null,
    { revokeAllForUser: jest.fn() },
    null,
    null,
    {
      unitOfWork,
      roleChangeRepository,
      invitationRepository,
      invitationTokenService: {
        create: () => ({
          plaintextToken: 'secret-token',
          tokenHash: 'ab'.repeat(32),
        }),
      },
      invitationDelivery: delivery,
      invitationValiditySeconds: 3600,
      invitationWebUrl: 'https://example.test/activate',
    },
  );
  return {
    service,
    repository,
    roleChangeRepository,
    invitationRepository,
    unitOfWork,
    delivery,
  };
}

describe('AA06 role assignment and invitations', () => {
  test('assigns a supported role set and audits actor and before/after values', async () => {
    const admin = makeUser('USR-00001', ['ADMINISTRATOR']);
    const target = makeUser('USR-00002');
    const { service, roleChangeRepository, repository } = serviceFor({
      admin,
      target,
    });

    await service.updateRoles(
      target.getId().getValue(),
      { roles: ['CUSTOMER', 'EMPLOYEE'] },
      {
        sub: admin.getId().getValue(),
        roles: ['ADMINISTRATOR'],
      },
    );

    expect(target.getRoles()).toEqual(['CUSTOMER', 'EMPLOYEE']);
    expect(repository.save).toHaveBeenCalled();
    expect(roleChangeRepository.save).toHaveBeenCalledWith(
      expect.any(RoleChangeRecord),
      expect.any(Object),
    );
    const record = roleChangeRepository.save.mock.calls[0][0];
    expect(record).toMatchObject({
      userId: target.getId().getValue(),
      previousRoles: ['CUSTOMER'],
      newRoles: ['CUSTOMER', 'EMPLOYEE'],
      actor: { type: 'ADMINISTRATOR', userId: admin.getId().getValue() },
    });
  });

  test('denies a Manager and blocks removal of the last active Administrator', async () => {
    const admin = makeUser('USR-00001', ['ADMINISTRATOR']);
    const target = makeUser('USR-00001', ['ADMINISTRATOR']);
    const { service, repository } = serviceFor({
      admin,
      target,
      databaseQuery: jest.fn().mockResolvedValue({ rows: [{ count: 0 }] }),
    });

    await expect(
      service.updateRoles(
        target.getId().getValue(),
        { roles: [] },
        {
          sub: admin.getId().getValue(),
          roles: ['MANAGER'],
        },
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.updateRoles(
        target.getId().getValue(),
        { roles: [] },
        {
          sub: admin.getId().getValue(),
          roles: ['ADMINISTRATOR'],
        },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.save).not.toHaveBeenCalled();
  });

  test('keeps a newly registered account inactive and reports a failed invitation', async () => {
    const admin = makeUser('USR-00001', ['ADMINISTRATOR']);
    const target = User.createInactive(
      UserId.create('USR-00002'),
      UserName.create('New User'),
      Email.create('new@example.test'),
      Password.createFromHash(hash),
      MarketingConsent.create(false),
    );
    const delivery = {
      sendInvitation: jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('SMTP authentication failed'), {
            code: 'EAUTH',
            responseCode: 535,
            command: 'AUTH PLAIN',
          }),
        ),
    };
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { service, invitationRepository } = serviceFor({
      admin,
      target,
      delivery,
    });

    const result = await service.issueActivationInvitation(
      target.getId().getValue(),
      {
        sub: admin.getId().getValue(),
        roles: ['ADMINISTRATOR'],
      },
    );

    expect(result).toMatchObject({ deliveryStatus: 'FAILED', retryable: true });
    expect(result).not.toHaveProperty('token');
    expect(target.isActive()).toBe(false);
    expect(invitationRepository.replacePending).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: target.getId().getValue(),
        email: 'new@example.test',
      }),
      expect.any(Object),
    );
    expect(logError).toHaveBeenCalledWith(
      'AA06 activation invitation delivery failed',
      { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' },
    );
    logError.mockRestore();
  });

  test('restores a previously activated account but rejects an invited account', async () => {
    const admin = makeUser('USR-00001', ['ADMINISTRATOR']);
    const target = makeUser('USR-00002');
    target.deactivate();
    const { service } = serviceFor({ admin, target });
    await expect(
      service.reactivateUser(target.getId().getValue(), {
        sub: admin.getId().getValue(),
        roles: ['ADMINISTRATOR'],
      }),
    ).resolves.toMatchObject({ active: true });

    const invited = User.createInactive(
      UserId.create('USR-00003'),
      UserName.create('Invitee'),
      Email.create('invitee@example.test'),
      Password.createFromHash(hash),
      MarketingConsent.create(false),
    );
    const invitedService = serviceFor({ admin, target: invited }).service;
    await expect(
      invitedService.reactivateUser(invited.getId().getValue(), {
        sub: admin.getId().getValue(),
        roles: ['ADMINISTRATOR'],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
