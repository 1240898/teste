import { ExternalAuthorizationDTO } from '../dtos/ExternalAuthorizationDTO.js';
import { User } from '../../domain/model/User.js';
import {
  Email,
  UserId,
  UserName,
  MarketingConsent,
  ExternalIdentity,
} from '../../domain/model/values.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { RoleChangeRecord } from '../../domain/model/RoleChangeRecord.js';
import { EXTERNAL_AUTH_FAILED } from '../../domain/model/ActivationInvitation.js';

// AA03: the access-denied messages are defined once, by UserService.
export { ACCOUNT_NOT_ACTIVE, NO_ACTIVE_ROLE } from './UserService.js';

export { EXTERNAL_AUTH_FAILED };

export const ACTIVATION_PURPOSE = 'ACTIVATION';
const LOGIN_PURPOSE = 'LOGIN';

export const EMAIL_ALREADY_ASSOCIATED =
  'This e-mail is already associated with an account. Sign in with your local credentials or use your activation invitation.';

// AA02 BR 17: Google "name" claim, otherwise the e-mail local part (max. 100 chars).
function displayName(claims, email) {
  const name = typeof claims.name === 'string' ? claims.name.trim() : '';
  const fallback = email.getValue().split('@')[0];
  return UserName.create((name || fallback).slice(0, 100).trim() || fallback);
}

/**
 * AA02 – External Identity Provider Integration (Google OIDC).
 * Orchestrates start/callback, identity verification, account resolution and the
 * session-start checks. Token issuance is delegated to UserService (same token as AA01).
 */
export class ExternalAuthenticationService {
  constructor(
    userRepository,
    identityProvider,
    stateStore,
    userService,
    logger = console,
    aa06 = {},
  ) {
    Object.assign(this, {
      userRepository,
      identityProvider,
      stateStore,
      userService,
      logger,
      ...aa06,
    });
  }

  async startAuthorization(purpose = LOGIN_PURPOSE, binding = undefined) {
    const request = await this.identityProvider.createAuthorizationRequest();
    await this.stateStore.save(request.state, {
      provider: this.identityProvider.provider,
      nonce: request.nonce,
      codeVerifier: request.codeVerifier,
      purpose,
      binding,
    });
    return new ExternalAuthorizationDTO({
      authorizationUrl: request.authorizationUrl,
      state: request.state,
    });
  }

  async completeAuthorization(dto) {
    const claims = await this.verifyIdentity(dto.code, dto.state);
    const user = await this.#resolveAccount(claims);
    this.#assertCanStartSession(user);
    return this.userService.issueAuthToken(user);
  }

  /** Reusable by AA07: consumes the state and returns verified identity claims. */
  async verifyIdentity(code, state, purpose = LOGIN_PURPOSE) {
    const pending = await this.stateStore.consume(state, purpose);
    if (!pending || (pending.purpose ?? LOGIN_PURPOSE) !== purpose)
      this.#fail('unknown, expired, used or wrong-purpose state');
    let claims;
    try {
      claims = await this.identityProvider.exchangeAndVerify(
        code,
        pending.codeVerifier,
        pending.nonce,
      );
    } catch {
      this.#fail('identity provider error');
    }
    if (
      !claims ||
      claims.provider !== pending.provider ||
      claims.emailVerified !== true ||
      typeof claims.email !== 'string' ||
      typeof claims.subject !== 'string' ||
      !claims.subject
    )
      this.#fail('unverified or incomplete identity claims');
    return purpose === ACTIVATION_PURPOSE
      ? { claims, binding: pending.binding }
      : claims;
  }

  async #resolveAccount(claims) {
    let identity;
    let email;
    try {
      identity = ExternalIdentity.create(claims.provider, claims.subject);
      email = Email.create(claims.email);
    } catch {
      this.#fail('identity claims rejected by domain validation');
    }
    // Returning user: reused as is (no re-creation, no role change, no reactivation).
    const linked = await this.userRepository.findByExternalIdentity(
      identity.getProvider(),
      identity.getSubject(),
    );
    if (linked) return linked;
    // AA02 BR 14 (decision D3): no automatic linking by e-mail.
    if (await this.userRepository.findByEmail(email))
      throw new AppError(EMAIL_ALREADY_ASSOCIATED, 409);
    // AA02 BR 9 (client clarification Q2): active CUSTOMER account, no invitation.
    const user = User.createFromExternalIdentity(
      UserId.create(await this.userRepository.nextId()),
      displayName(claims, email),
      email,
      identity,
      MarketingConsent.create(false),
    );
    try {
      const save = async (tx) => {
        const saved = await this.userRepository.save(user, tx);
        if (this.roleChangeRepository)
          await this.roleChangeRepository.save(
            new RoleChangeRecord({
              userId: saved.getId().getValue(),
              previousRoles: [],
              newRoles: saved.getRoles(),
              actor: {
                type: 'SYSTEM_PROCESS',
                systemProcess: 'INITIAL_CUSTOMER_ASSIGNMENT',
              },
            }),
            tx,
          );
        return saved;
      };
      return this.unitOfWork
        ? await this.unitOfWork.withTransaction(save)
        : await save(undefined);
    } catch (error) {
      // Concurrent first sign-in: the unique constraints reject the second insert.
      if (error instanceof AppError && error.status === 409)
        throw new AppError(EMAIL_ALREADY_ASSOCIATED, 409);
      throw error;
    }
  }

  // AA02 D9 / BR 6: no session for inactive accounts or accounts without roles.
  // AA03 (D4, BR 10): same check as local login and every protected request.
  #assertCanStartSession(user) {
    this.userService.assertCanAccess(user);
  }

  // AA02 BR 16 / D6: uniform response; the reason is logged without codes or tokens.
  #fail(reason) {
    this.logger.warn?.(`External authentication failed: ${reason}`);
    throw new AppError(EXTERNAL_AUTH_FAILED, 401);
  }
}
