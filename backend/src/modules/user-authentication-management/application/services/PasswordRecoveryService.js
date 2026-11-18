import { Email, UserId } from '../../domain/model/values.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { validatePassword } from './passwordPolicy.js';

export class PasswordRecoveryService {
  constructor({
    userRepository,
    recoveryRepository,
    tokenService,
    passwordHasher,
    delivery,
    unitOfWork,
    sessions = null,
    validitySeconds = 1800,
    webUrl = 'http://localhost:5173/',
  }) {
    Object.assign(this, {
      userRepository,
      recoveryRepository,
      tokenService,
      passwordHasher,
      delivery,
      unitOfWork,
      sessions,
      validitySeconds,
      webUrl,
    });
  }

  async requestRecovery(emailAddress) {
    const user = await this.userRepository.findByEmail(
      Email.create(emailAddress),
    );
    if (!user?.getPassword()) return;

    const { plaintextToken, tokenHash } = this.tokenService.createLinkToken();
    const expiresAt = new Date(Date.now() + this.validitySeconds * 1000);
    const userId = user.getId().getValue();
    const issued = await this.unitOfWork.withTransaction((tx) =>
      this.recoveryRepository.replaceActive(userId, tokenHash, expiresAt, tx),
    );
    if (!issued) return;

    const recoveryUrl = new URL(this.webUrl);
    recoveryUrl.searchParams.set('recoveryToken', plaintextToken);
    try {
      await this.delivery.sendRecoveryLink(
        user.getEmail().getValue(),
        recoveryUrl.toString(),
      );
    } catch {
      // Keep the public response identical for known and unknown accounts.
      console.error('Password recovery email delivery failed');
    }
  }

  async completeRecovery(linkToken, newPassword) {
    validatePassword(newPassword, { status: 422 });
    const tokenHash = this.tokenService.hashToken(linkToken);
    await this.unitOfWork.withTransaction(async (tx) => {
      const candidate = await this.recoveryRepository.findUsableForUpdate(
        tokenHash,
        tx,
      );
      if (!candidate) this.#invalidToken();

      const user = await this.userRepository.findById(
        UserId.create(candidate.userId),
        tx,
      );
      const currentPassword = user?.getPassword();
      if (!currentPassword) this.#invalidToken();

      if (
        await this.passwordHasher.compare(
          newPassword,
          currentPassword.getHash(),
        )
      )
        throw new AppError(
          'The new password must differ from the current password',
          422,
        );

      const passwordHash = await this.passwordHasher.hash(newPassword);
      const updated = await this.recoveryRepository.consumeAndUpdatePassword(
        tokenHash,
        candidate.userId,
        passwordHash,
        tx,
      );
      if (!updated) this.#invalidToken();
      await this.sessions?.revokeAllForUser?.(candidate.userId, tx);
    });
  }

  #invalidToken() {
    throw new AppError('Invalid or expired recovery link', 422);
  }
}
