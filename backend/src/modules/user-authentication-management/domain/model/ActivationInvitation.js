import { AppError } from '../../../../shared/errors/AppError.js';
import { Email, ExternalIdentity, Password, UserId } from './values.js';

export const INVITATION_UNAVAILABLE = 'This invitation can no longer be used.';
export const ACTIVATION_PASSWORD_REQUIRED =
  'Password is required to activate this account.';
export const ACTIVATION_PASSWORD_CONFLICT =
  'This account already has a password.';
export const EXTERNAL_AUTH_FAILED = 'External authentication failed';

export function invitationUnavailable() {
  return new AppError(INVITATION_UNAVAILABLE, 400);
}

export class ActivationCredential {
  constructor(method, password, identity, verifiedEmail) {
    if (!(
      (method === 'LOCAL' &&
        (password === null || password instanceof Password) &&
        identity === null &&
        verifiedEmail === null) ||
      (method === 'EXTERNAL' &&
        password === null &&
        identity instanceof ExternalIdentity &&
        verifiedEmail instanceof Email)
    ))
      throw new TypeError('Invalid activation credential');
    Object.assign(this, { method, password, identity, verifiedEmail });
    Object.freeze(this);
  }

  static local(password = null) {
    return new ActivationCredential('LOCAL', password, null, null);
  }

  static external(identity, verifiedEmail) {
    return new ActivationCredential('EXTERNAL', null, identity, verifiedEmail);
  }
}

export class ActivationInvitation {
  #status;

  constructor({ userId, intendedEmail, method, expiresAt, status }) {
    this.userId = UserId.create(userId);
    this.intendedEmail = Email.create(intendedEmail);
    this.method = method;
    this.expiresAt = expiresAt.getTime();
    this.#status = status;
    Object.freeze(this);
  }

  assertRedeemable(userId, email, method, now) {
    if (
      this.#status !== 'PENDING' ||
      !(now.getTime() < this.expiresAt) ||
      !this.userId.equals(userId) ||
      !this.intendedEmail.equals(email) ||
      this.method !== method
    )
      throw invitationUnavailable();
  }

  markUsed() {
    this.#status = 'USED';
  }
}
