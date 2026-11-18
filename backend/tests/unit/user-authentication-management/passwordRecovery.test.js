import { jest } from '@jest/globals';
import { PasswordRecoveryService } from '../../../src/modules/user-authentication-management/application/services/PasswordRecoveryService.js';
import { RecoveryTokenCandidate } from '../../../src/modules/user-authentication-management/application/readModels/RecoveryTokenCandidate.js';
import { User } from '../../../src/modules/user-authentication-management/domain/model/User.js';
import {
  Email,
  MarketingConsent,
  Password,
  UserId,
  UserName,
} from '../../../src/modules/user-authentication-management/domain/model/values.js';

const userId = 'USR-00001';
const validPassword = 'NewStrongPass123!';
const tx = { id: 'transaction-test-double' };
const existingPasswordHash = '$2b$10$' + 'a'.repeat(53);

function createUser() {
  return User.create(
    UserId.create(userId),
    UserName.create('Ana'),
    Email.create('ana@example.com'),
    Password.createFromHash(existingPasswordHash),
    MarketingConsent.create(false),
  );
}

function setup({ candidate = new RecoveryTokenCandidate({ userId }) } = {}) {
  const user = createUser();
  const userRepository = {
    findByEmail: jest.fn().mockResolvedValue(user),
    findById: jest.fn().mockResolvedValue(user),
  };
  const recoveryRepository = {
    replaceActive: jest.fn().mockResolvedValue(true),
    findUsableForUpdate: jest.fn().mockResolvedValue(candidate),
    consumeAndUpdatePassword: jest.fn().mockResolvedValue(true),
  };
  const tokenService = {
    createLinkToken: jest.fn().mockReturnValue({
      plaintextToken: 'one-time-secret',
      tokenHash: 'a'.repeat(64),
    }),
    hashToken: jest.fn().mockReturnValue('a'.repeat(64)),
  };
  const passwordHasher = {
    compare: jest.fn().mockResolvedValue(false),
    hash: jest.fn().mockResolvedValue('replacement-password-hash'),
  };
  const delivery = { sendRecoveryLink: jest.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    withTransaction: jest.fn(async (work) => work(tx)),
  };
  const sessions = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
  const service = new PasswordRecoveryService({
    userRepository,
    recoveryRepository,
    tokenService,
    passwordHasher,
    delivery,
    unitOfWork,
    sessions,
    validitySeconds: 600,
    webUrl: 'https://example.test/recover',
  });
  return {
    service,
    user,
    userRepository,
    recoveryRepository,
    tokenService,
    passwordHasher,
    delivery,
    unitOfWork,
    sessions,
  };
}

describe('PasswordRecoveryService', () => {
  test('keeps an external-only account ineligible for local password recovery', async () => {
    const { service, userRepository, tokenService, recoveryRepository, delivery } =
      setup();
    const externalUser = { getPassword: () => null };
    userRepository.findByEmail.mockResolvedValue(externalUser);
    userRepository.findById.mockResolvedValue(externalUser);

    await service.requestRecovery('ana@example.com');

    expect(tokenService.createLinkToken).not.toHaveBeenCalled();
    expect(recoveryRepository.replaceActive).not.toHaveBeenCalled();
    expect(delivery.sendRecoveryLink).not.toHaveBeenCalled();
    await expect(
      service.completeRecovery('one-time-secret', validPassword),
    ).rejects.toMatchObject({
      status: 422,
      message: 'Invalid or expired recovery link',
    });
    expect(recoveryRepository.consumeAndUpdatePassword).not.toHaveBeenCalled();
  });

  test('issues a hashed, expiring token and emails the single-use link', async () => {
    const {
      service,
      userRepository,
      recoveryRepository,
      tokenService,
      delivery,
      unitOfWork,
    } = setup();

    await service.requestRecovery('ANA@example.com');

    expect(userRepository.findByEmail).toHaveBeenCalledWith(
      Email.create('ana@example.com'),
    );
    expect(recoveryRepository.replaceActive).toHaveBeenCalledWith(
      userId,
      'a'.repeat(64),
      expect.any(Date),
      tx,
    );
    expect(unitOfWork.withTransaction).toHaveBeenCalledTimes(1);
    const [recipient, link] = delivery.sendRecoveryLink.mock.calls[0];
    expect(recipient).toBe('ana@example.com');
    expect(new URL(link).searchParams.get('recoveryToken')).toBe(
      'one-time-secret',
    );
    expect(link).not.toContain('a'.repeat(64));
    expect(tokenService.createLinkToken).toHaveBeenCalledTimes(1);
  });

  test('does not issue or deliver a token for an unknown email', async () => {
    const {
      service,
      userRepository,
      recoveryRepository,
      tokenService,
      delivery,
    } = setup();
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.requestRecovery('unknown@example.com'),
    ).resolves.toBeUndefined();

    expect(recoveryRepository.replaceActive).not.toHaveBeenCalled();
    expect(tokenService.createLinkToken).not.toHaveBeenCalled();
    expect(delivery.sendRecoveryLink).not.toHaveBeenCalled();
  });

  test('updates the password and consumes a valid token in one transaction', async () => {
    const {
      service,
      recoveryRepository,
      tokenService,
      passwordHasher,
      unitOfWork,
      sessions,
    } = setup();

    await service.completeRecovery('one-time-secret', validPassword);

    expect(tokenService.hashToken).toHaveBeenCalledWith('one-time-secret');
    expect(recoveryRepository.findUsableForUpdate).toHaveBeenCalledWith(
      'a'.repeat(64),
      tx,
    );
    expect(passwordHasher.compare).toHaveBeenCalledWith(
      validPassword,
      existingPasswordHash,
    );
    expect(recoveryRepository.consumeAndUpdatePassword).toHaveBeenCalledWith(
      'a'.repeat(64),
      userId,
      'replacement-password-hash',
      tx,
    );
    expect(unitOfWork.withTransaction).toHaveBeenCalledTimes(1);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(userId, tx);
  });

  test('rejects an expired, used or invalidated token without changing the password', async () => {
    const { service, recoveryRepository, passwordHasher } = setup({
      candidate: null,
    });

    await expect(
      service.completeRecovery('one-time-secret', validPassword),
    ).rejects.toMatchObject({ status: 422 });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(recoveryRepository.consumeAndUpdatePassword).not.toHaveBeenCalled();
  });

  test('rejects reuse of the current password', async () => {
    const { service, recoveryRepository, passwordHasher } = setup();
    passwordHasher.compare.mockResolvedValue(true);

    await expect(
      service.completeRecovery('one-time-secret', validPassword),
    ).rejects.toMatchObject({ status: 422 });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(recoveryRepository.consumeAndUpdatePassword).not.toHaveBeenCalled();
  });

  test('rejects a concurrent use when conditional token consumption loses the race', async () => {
    const { service, recoveryRepository } = setup();
    recoveryRepository.consumeAndUpdatePassword.mockResolvedValue(false);

    await expect(
      service.completeRecovery('one-time-secret', validPassword),
    ).rejects.toMatchObject({ status: 422 });
  });

  test('rejects passwords that do not satisfy the shared policy', async () => {
    const { service, unitOfWork, tokenService } = setup();

    await expect(
      service.completeRecovery('one-time-secret', 'weak-password'),
    ).rejects.toMatchObject({ status: 422 });

    expect(unitOfWork.withTransaction).not.toHaveBeenCalled();
    expect(tokenService.hashToken).not.toHaveBeenCalled();
  });
});
