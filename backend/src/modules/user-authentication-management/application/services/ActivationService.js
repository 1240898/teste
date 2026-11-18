import { AppError } from '../../../../shared/errors/AppError.js';
import {
  Email,
  ExternalIdentity,
  Password,
  UserId,
} from '../../domain/model/values.js';
import {
  ActivationCredential,
  ActivationInvitation,
  EXTERNAL_AUTH_FAILED,
  invitationUnavailable,
} from '../../domain/model/ActivationInvitation.js';
import { ACTIVATION_PURPOSE } from './ExternalAuthenticationService.js';
import { validatePassword } from './passwordPolicy.js';

export class ActivationService {
  constructor({
    invitationRepository,
    userRepository,
    unitOfWork,
    activationLock,
    tokenService,
    passwordHasher,
    externalAuthService,
    userService,
  }) {
    Object.assign(this, {
      invitationRepository,
      userRepository,
      unitOfWork,
      activationLock,
      tokenService,
      passwordHasher,
      externalAuthService,
      userService,
    });
  }

  async #binding(token, method) {
    const binding = await this.invitationRepository.findEligibleBinding(
      this.tokenService.hash(token),
    );
    if (!binding || (method && binding.method !== method))
      throw invitationUnavailable();
    return binding;
  }

  async inspect(token) {
    const { method } = await this.#binding(token);
    return { method };
  }

  async activateLocal(token, password) {
    const binding = await this.#binding(token, 'LOCAL');
    let credential;
    if (password !== undefined) {
      validatePassword(password);
      credential = Password.createFromHash(
        await this.passwordHasher.hash(password),
      );
    }
    await this.#commitActivation(
      binding,
      ActivationCredential.local(credential),
    );
    return { nextSignIn: 'LOCAL' };
  }

  async startExternal(token) {
    const binding = await this.#binding(token, 'EXTERNAL');
    return this.#externalAuth().startAuthorization(ACTIVATION_PURPOSE, binding);
  }

  async completeExternal(code, state) {
    const { claims, binding } = await this.#externalAuth().verifyIdentity(
      code,
      state,
      ACTIVATION_PURPOSE,
    );
    if (!binding || binding.method !== 'EXTERNAL')
      throw new AppError(EXTERNAL_AUTH_FAILED, 401);
    let credential;
    try {
      credential = ActivationCredential.external(
        ExternalIdentity.create(claims.provider, claims.subject),
        Email.create(claims.email),
      );
    } catch {
      throw new AppError(EXTERNAL_AUTH_FAILED, 401);
    }
    const id = await this.#commitActivation(binding, credential);

    try {
      const user = await this.userRepository.findById(id);
      if (user) {
        this.userService.assertCanAccess(user);
        const auth = await this.userService.issueAuthToken(user);
        return { status: 'SIGNED_IN', auth };
      }
    } catch {
      // Redemption has committed. The recipient can retry normal Google sign-in.
    }
    return { status: 'ACTIVATED', nextSignIn: 'EXTERNAL' };
  }

  #externalAuth() {
    if (!this.externalAuthService)
      throw new AppError(EXTERNAL_AUTH_FAILED, 401);
    return this.externalAuthService;
  }

  #commitActivation({ tokenHash, userId }, credential) {
    return this.unitOfWork.withTransaction(async (tx) => {
      await this.activationLock.acquireMembershipLock(tx);
      const id = UserId.create(userId);
      const user = await this.userRepository.findById(id, tx);
      if (!user) throw invitationUnavailable();
      const row = await this.invitationRepository.loadForRedemption(
        tokenHash,
        userId,
        tx,
      );
      if (!row) throw invitationUnavailable();
      user.redeemInvitation(
        new ActivationInvitation(row),
        credential,
        new Date(),
      );
      await this.userRepository.saveActivation(user, tx);
      if (!(await this.invitationRepository.consume(tokenHash, userId, tx)))
        throw invitationUnavailable();
      return id;
    });
  }
}
