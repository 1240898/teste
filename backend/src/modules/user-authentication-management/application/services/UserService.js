import { AuthTokenDTO } from '../dtos/AuthTokenDTO.js';
import { AuthenticatedActor } from '../dtos/AuthenticatedActor.js';
import { User } from '../../domain/model/User.js';
import {
  Email,
  UserId,
  UserName,
  Password,
  MarketingConsent,
} from '../../domain/model/values.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { UserResponseMapper } from '../mapping/UserResponseMapper.js';
import { validatePassword, validatePasswordChange } from './passwordPolicy.js';
import { RoleChangeRecord } from '../../domain/model/RoleChangeRecord.js';

const dummyHash =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// AA03 access-denied messages (BR 8), shared with the external sign-in (AA02).
export const ACCOUNT_NOT_ACTIVE = 'Account is not active';
export const NO_ACTIVE_ROLE = 'No active role is assigned to this account';
const INVALID_TOKEN = 'Invalid or expired token';
const ACTIVATION_METHODS = new Set(['LOCAL', 'EXTERNAL']);

function requireAdministrator(actor) {
  if (!actor) throw new AppError('Authentication required', 401);
  if (!actor.roles.includes('ADMINISTRATOR'))
    throw new AppError('Forbidden: Administrator role required', 403);
}

function found(user) {
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export class UserService {
  constructor(
    userRepository,
    passwordHasher,
    tokenService,
    requestActivationInvitation = null,
    sessions = null,
    credentials = null,
    sessionConfig = null,
    aa06 = {},
  ) {
    Object.assign(this, {
      userRepository,
      passwordHasher,
      tokenService,
      requestActivationInvitation,
      sessions,
      credentials,
      sessionConfig,
      ...aa06,
    });
  }

  async register({ name, email, password, marketingConsent = false, phoneNumber }) {
    const userName = UserName.create(name);
    const userEmail = Email.create(email);
    validatePassword(password);
    const consent = MarketingConsent.create(marketingConsent);
    // the phone number belongs to the customer record, validated by the
    // customer module before the (expensive) password hash is computed.
    this.customerProfiles?.validatePhoneNumber(
      userEmail.getValue(),
      phoneNumber,
    );
    if (!this.unitOfWork && (await this.userRepository.findByEmail(userEmail)))
      throw new AppError('Email already registered', 409);
    const credential = Password.createFromHash(
      await this.passwordHasher.hash(password),
    );
    const createRegistration = async (tx) => {
      // Check inside the same transaction as creation; the unique email
      // constraint remains the final guard against concurrent registration.
      if (tx && (await this.userRepository.findByEmail(userEmail, tx)))
        throw new AppError('Email already registered', 409);
      const id = UserId.create(await this.userRepository.nextId(tx));
      const user = User.createInactive(
        id,
        userName,
        userEmail,
        credential,
        consent,
      );
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
      // the customer record is created in the same transaction.
      if (this.customerProfiles)
        await this.customerProfiles.createForNewAccount(
          {
            userId: saved.getId().getValue(),
            name: saved.getName().getValue(),
            email: saved.getEmail().getValue(),
            phoneNumber,
          },
          tx,
        );
      const invitation = this.invitationRepository
        ? await this.#createInvitation(
            saved.getId().getValue(),
            saved.getEmail().getValue(),
            'LOCAL',
            tx,
          )
        : null;
      return { saved, invitation };
    };
    const result = this.unitOfWork
      ? await this.unitOfWork.withTransaction(createRegistration)
      : await createRegistration(undefined);
    let invitationDelivery;
    if (result.invitation) {
      invitationDelivery = await this.#deliverInvitation(result.invitation);
    } else if (this.requestActivationInvitation) {
      try {
        // Retain the injected legacy port for non-PostgreSQL adapters. The
        // production PostgreSQL path persists the LOCAL invitation above.
        invitationDelivery = await this.requestActivationInvitation(
          result.saved.getId().getValue(),
        );
      } catch {
        console.warn('AA06 invitation request failed after local registration');
        invitationDelivery = { deliveryStatus: 'FAILED', retryable: true };
      }
    } else {
      invitationDelivery = {
        deliveryStatus: 'NOT_CONFIGURED',
        retryable: true,
      };
    }
    return Object.assign(UserResponseMapper.toDTO(result.saved), {
      invitationDelivery,
    });
  }

  async inviteWorker({ name, email, role, activationMethod }, actor) {
    requireAdministrator(actor);
    if (
      !this.invitationRepository ||
      !this.invitationTokenService ||
      !this.invitationDelivery
    )
      throw new AppError('Invitation delivery is not configured', 503);
    if (!ACTIVATION_METHODS.has(activationMethod))
      throw new AppError('Invalid activation method', 400);

    const userName = UserName.create(name);
    const userEmail = Email.create(email);
    const provision = () =>
      this.#adminTransaction(actor, async (tx) => {
        const existing = await this.userRepository.findByEmail(userEmail, tx);
        let user;
        let previousRoles;
        let isNew = false;
        if (existing) {
          user = existing;
          if (user.wasEverActivated() && !user.isActive())
            throw new AppError(
              'Previously activated accounts must be reactivated',
              409,
            );
          previousRoles = user.getRoles();
          user.addRole(role);
        } else {
          const id = UserId.create(await this.userRepository.nextId(tx));
          user = User.createInactive(
            id,
            userName,
            userEmail,
            null,
            MarketingConsent.create(false),
          );
          previousRoles = [];
          isNew = true;
          user.addRole(role);
        }

        const nextRoles = user.getRoles();
        const rolesChanged =
          previousRoles.length !== nextRoles.length ||
          previousRoles.some((previous) => !nextRoles.includes(previous));
        const saved = await this.userRepository.save(user, tx);

        if (isNew && this.roleChangeRepository) {
          await this.roleChangeRepository.save(
            new RoleChangeRecord({
              userId: user.getId().getValue(),
              previousRoles: [],
              newRoles: ['CUSTOMER'],
              actor: {
                type: 'SYSTEM_PROCESS',
                systemProcess: 'INITIAL_CUSTOMER_ASSIGNMENT',
              },
            }),
            tx,
          );
        }
        if (
          rolesChanged &&
          (!isNew || role !== 'CUSTOMER') &&
          this.roleChangeRepository
        ) {
          await this.roleChangeRepository.save(
            new RoleChangeRecord({
              userId: user.getId().getValue(),
              previousRoles: isNew ? ['CUSTOMER'] : previousRoles,
              newRoles: nextRoles,
              actor: { type: 'ADMINISTRATOR', userId: actor.sub },
            }),
            tx,
          );
        }

        if (saved.isActive()) return { user: saved, invitation: null };

        const previousMethod =
          await this.invitationRepository.findLatestMethodForUpdate?.(
            saved.getId().getValue(),
            tx,
          );
        if (previousMethod && previousMethod !== activationMethod)
          throw new AppError(
            'A replacement invitation must keep its existing activation method',
            409,
          );
        const method = previousMethod ?? activationMethod;
        const invitation = await this.#createInvitation(
          saved.getId().getValue(),
          saved.getEmail().getValue(),
          method,
          tx,
        );
        return { user: saved, invitation };
      });
    let issued;
    try {
      issued = await provision();
    } catch (error) {
      // Public registration can race this administrator operation because it
      // does not require Administrator authorization. If its unique-email
      // insert wins, retry against that account rather than creating a second
      // one or returning a duplicate-account conflict.
      if (
        error?.status !== 409 ||
        error?.message !== 'Email already registered'
      )
        throw error;
      issued = await provision();
    }

    const invitationDelivery = issued.invitation
      ? await this.#deliverInvitation(issued.invitation)
      : {
          deliveryStatus: 'NOT_REQUIRED',
          expiresAt: null,
          retryable: false,
        };
    return {
      user: UserResponseMapper.toDTO(issued.user),
      invitationDelivery,
    };
  }
  async login({ email, password }) {
    if (
      typeof password !== 'string' ||
      !password ||
      Buffer.byteLength(password, 'utf8') > 72 ||
      password.includes('\0')
    )
      throw new AppError('Invalid email or password', 401);
    const user = await this.userRepository.findByEmail(Email.create(email));
    const passwordHash = user?.getPassword()?.getHash();
    const matches = await this.passwordHasher.compare(
      password,
      passwordHash ?? dummyHash,
    );
    // AA02 BR 18 (D8): external-only accounts are rejected explicitly,
    // independently of the comparison result.
    if (!user || !passwordHash || !matches)
      throw new AppError('Invalid email or password', 401);
    // AA03 (BR 12): access-state messages only after the password matched.
    this.assertCanAccess(user);
    // AA03 (BR 5): login never saves the User (roles / active state unchanged).
    return this.issueAuthToken(user);
  }

  /**
   * AA03 (D4): single access-state check, shared by local login, external
   * login (AA02), resolveActor() and getCurrentUser().
   */
  assertCanAccess(user) {
    if (!user.isActive()) throw new AppError(ACCOUNT_NOT_ACTIVE, 403);
    if (!user.hasActiveRole()) throw new AppError(NO_ACTIVE_ROLE, 403);
  }

  /**
   * Establishes the common AA04 session for an authenticated, already-checked
   * user. Local (AA01) and verified external (AA02) sign-in share this path.
   */
  issueAuthToken(user) {
    if (this.sessions && this.credentials) return this.establishSession(user);
    // The "roles" claim is informational only; authorization always reloads
    // the roles from the database (AA03, D3).
    const payload = {
      sub: user.getId().getValue(),
      email: user.getEmail().getValue(),
      roles: user.getRoles(),
    };
    return new AuthTokenDTO({
      accessToken: this.tokenService.generateToken(payload),
      tokenType: 'Bearer',
      expiresIn: this.tokenService.expiresIn,
      hasLocalCredential: user.hasLocalPassword(),
      user: UserResponseMapper.toDTO(user),
    });
  }

  async establishSession(user) {
    await this.sessions.purgeEnded?.(
      this.sessionConfig.sessionRetentionSeconds,
    );
    const credential = this.credentials.create();
    const record = await this.sessions.create({
      id: credential.id,
      userId: user.getId().getValue(),
      hash: credential.hash,
      csrfToken: credential.csrfTokenBytes,
      idleSeconds: this.sessionConfig.idleTimeoutSeconds,
    });
    return this.#sessionToken(
      user,
      record,
      credential.value,
      credential.csrfToken,
    );
  }

  #sessionToken(user, record, sessionCredential, csrfToken) {
    return new AuthTokenDTO({
      accessToken: this.tokenService.generateToken({
        sub: user.getId().getValue(),
        sid: record.id,
      }),
      tokenType: 'Bearer',
      expiresIn: this.tokenService.expiresIn,
      sessionCredential,
      csrfToken,
      idleTimeoutSeconds: this.sessionConfig.idleTimeoutSeconds,
      activityReportIntervalSeconds:
        this.sessionConfig.activityReportIntervalSeconds,
      idleExpiresAt: record.idle_expires_at,
      hasLocalCredential: user.hasLocalPassword(),
      user: UserResponseMapper.toDTO(user),
    });
  }

  async renew(sessionCredential, csrfToken) {
    const parsed = this.credentials?.parse(sessionCredential);
    if (!parsed) throw new AppError('Invalid or expired session', 401);
    const existing = await this.sessions.findByCredential(
      parsed.id,
      parsed.hash,
    );
    if (
      !existing ||
      existing.revoked_at ||
      !this.credentials.matchesCsrf(existing.csrf_token, csrfToken)
    )
      throw new AppError('Invalid or expired session', 401);
    const user = await this.userRepository.findById(
      UserId.create(existing.user_id),
    );
    if (!user) throw new AppError('Invalid or expired session', 401);
    this.assertCanAccess(user);
    const replacement = this.credentials.create();
    const renewed = await this.sessions.renew(
      parsed.id,
      parsed.hash,
      existing.csrf_token,
      {
        id: replacement.id,
        hash: replacement.hash,
        csrfToken: replacement.csrfTokenBytes,
      },
      this.sessionConfig.idleTimeoutSeconds,
    );
    if (!renewed) throw new AppError('Invalid or expired session', 401);
    return this.#sessionToken(
      user,
      renewed,
      replacement.value,
      replacement.csrfToken,
    );
  }

  async logout(sessionCredential, csrfToken) {
    const parsed = this.credentials?.parse(sessionCredential);
    if (!parsed) throw new AppError('Invalid or expired session', 401);
    const existing = await this.sessions.findByCredential(
      parsed.id,
      parsed.hash,
    );
    if (
      !existing ||
      !this.credentials.matchesCsrf(existing.csrf_token, csrfToken)
    )
      throw new AppError('Invalid or expired session', 401);
    if (
      !(await this.sessions.revoke(parsed.id, parsed.hash, existing.csrf_token))
    )
      throw new AppError('Invalid or expired session', 401);
  }

  async resume(sessionCredential) {
    const parsed = this.credentials?.parse(sessionCredential);
    if (!parsed) throw new AppError('Invalid or expired session', 401);
    const record = await this.sessions.findResumable(parsed.id, parsed.hash);
    if (!record) throw new AppError('Invalid or expired session', 401);
    const user = await this.userRepository.findById(
      UserId.create(record.user_id),
    );
    if (!user) throw new AppError('Invalid or expired session', 401);
    this.assertCanAccess(user);
    const csrfToken = record.csrf_token.toString('base64url');
    return this.#sessionToken(user, record, sessionCredential, csrfToken);
  }

  async changePassword(actor, { currentPassword, newPassword }) {
    if (!actor?.sub) throw new AppError('Authentication required', 401);
    validatePassword(newPassword, { status: 422 });
    const user = await this.userRepository.findById(UserId.create(actor.sub));
    if (!user?.isActive()) throw new AppError('Invalid or expired token', 401);

    const currentHash = user.getPassword()?.getHash();
    if (!currentHash)
      throw new AppError('This account has no local password', 422);
    if (!(await this.passwordHasher.compare(currentPassword, currentHash)))
      throw new AppError('Current password is incorrect', 401);
    if (await this.passwordHasher.compare(newPassword, currentHash))
      throw new AppError(
        'The new password must differ from the current password',
        422,
      );
    validatePasswordChange(currentPassword, newPassword, { status: 422 });

    const nextHash = await this.passwordHasher.hash(newPassword);
    const replaceAndRevoke = async (tx) => {
      const updated = tx
        ? await this.userRepository.updatePasswordIfCurrent(
            user.getId(),
            currentHash,
            nextHash,
            tx,
          )
        : await this.userRepository.updatePasswordIfCurrent(
            user.getId(),
            currentHash,
            nextHash,
          );
      if (updated)
        await this.sessions?.revokeAllForUser?.(user.getId().getValue(), tx);
      return updated;
    };
    const database = this.userRepository.database;
    const updated =
      database && typeof database.withTransaction === 'function'
        ? await database.withTransaction(replaceAndRevoke)
        : await replaceAndRevoke(undefined);
    if (!updated)
      throw new AppError(
        'The account or password changed; sign in again and retry',
        409,
      );
    user.changePassword(Password.createFromHash(nextHash));
  }
  async listUsers(actor, { includeInactive = false } = {}) {
    requireAdministrator(actor);
    const users = await this.userRepository.findAll({ includeInactive });
    const methods = this.invitationRepository?.findLatestMethodsForUsers
      ? await this.invitationRepository.findLatestMethodsForUsers(
          users.map((user) => user.getId().getValue()),
        )
      : new Map();
    return users.map((user) =>
      UserResponseMapper.toDTO(user, {
        activationMethod: methods.get(user.getId().getValue()) ?? null,
      }),
    );
  }
  async getUserById(id, actor) {
    requireAdministrator(actor);
    const user = found(await this.userRepository.findById(UserId.create(id)));
    const methods = this.invitationRepository?.findLatestMethodsForUsers
      ? await this.invitationRepository.findLatestMethodsForUsers([id])
      : new Map();
    return UserResponseMapper.toDTO(user, {
      activationMethod: methods.get(id) ?? null,
    });
  }
  async updateRoles(id, dto, actor) {
    requireAdministrator(actor);
    return this.#adminTransaction(actor, async (tx) => {
      const user = found(
        await this.userRepository.findById(UserId.create(id), tx),
      );
      const previousRoles = user.getRoles();
      user.setRoles(dto.roles);
      const changed =
        previousRoles.length !== user.getRoles().length ||
        previousRoles.some((role) => !user.hasRole(role));
      if (
        changed &&
        user.isActive() &&
        previousRoles.includes('ADMINISTRATOR') &&
        !user.hasRole('ADMINISTRATOR')
      )
        await this.#assertAnotherActiveAdministrator(
          user.getId().getValue(),
          tx,
        );
      const updated = await this.userRepository.save(user, tx);
      if (changed && this.roleChangeRepository)
        await this.roleChangeRepository.save(
          new RoleChangeRecord({
            userId: id,
            previousRoles,
            newRoles: user.getRoles(),
            actor: { type: 'ADMINISTRATOR', userId: actor.sub },
          }),
          tx,
        );
      return UserResponseMapper.toDTO(updated);
    });
  }
  async deactivateUser(id, actor) {
    requireAdministrator(actor);
    await this.#adminTransaction(actor, async (tx) => {
      const user = found(
        await this.userRepository.findById(UserId.create(id), tx),
      );
      if (user.isActive() && user.hasRole('ADMINISTRATOR'))
        await this.#assertAnotherActiveAdministrator(id, tx);
      user.deactivate();
      await this.userRepository.save(user, tx);
      await this.sessions?.revokeAllForUser?.(id, tx);
    });
  }

  async reactivateUser(id, actor) {
    requireAdministrator(actor);
    return this.#adminTransaction(actor, async (tx) => {
      const user = found(
        await this.userRepository.findById(UserId.create(id), tx),
      );
      if (!user.wasEverActivated())
        throw new AppError('Account requires activation by invitation', 409);
      user.activate();
      return UserResponseMapper.toDTO(await this.userRepository.save(user, tx));
    });
  }

  async issueActivationInvitation(id, actor, { activationMethod } = {}) {
    requireAdministrator(actor);
    if (
      !this.invitationRepository ||
      !this.invitationTokenService ||
      !this.invitationDelivery
    )
      throw new AppError('Invitation delivery is not configured', 503);
    const issued = await this.#adminTransaction(actor, async (tx) => {
      const user = found(
        await this.userRepository.findById(UserId.create(id), tx),
      );
      if (user.wasEverActivated() || user.isActive())
        throw new AppError(
          'Previously activated accounts must be reactivated',
          409,
        );
      const methodLookupAvailable =
        typeof this.invitationRepository.findLatestMethodForUpdate ===
        'function';
      const existingMethod = methodLookupAvailable
        ? await this.invitationRepository.findLatestMethodForUpdate(id, tx)
        : 'LOCAL';
      if (
        existingMethod &&
        activationMethod &&
        existingMethod !== activationMethod
      )
        throw new AppError(
          'A replacement invitation must keep its existing activation method',
          409,
        );
      const method = existingMethod ?? activationMethod;
      if (!ACTIVATION_METHODS.has(method))
        throw new AppError(
          'An activation method is required for this invitation',
          400,
        );
      return this.#createInvitation(id, user.getEmail().getValue(), method, tx);
    });
    return {
      ...(await this.#deliverInvitation(issued)),
      activationMethod: issued.activationMethod,
    };
  }

  async #createInvitation(userId, email, activationMethod, tx) {
    if (!ACTIVATION_METHODS.has(activationMethod))
      throw new AppError('Invalid activation method', 400);
    const { plaintextToken, tokenHash } = this.invitationTokenService.create();
    const expiresAt = new Date(
      Date.now() + this.invitationValiditySeconds * 1000,
    );
    await this.invitationRepository.replacePending(
      { userId, email, tokenHash, expiresAt, activationMethod },
      tx,
    );
    return { email, plaintextToken, expiresAt, activationMethod };
  }

  async #deliverInvitation(issued) {
    const link = new URL(this.invitationWebUrl);
    link.searchParams.set('activationToken', issued.plaintextToken);
    try {
      await this.invitationDelivery.sendInvitation(
        issued.email,
        link.toString(),
        issued.expiresAt,
      );
      return {
        deliveryStatus: 'SENT',
        expiresAt: issued.expiresAt,
        retryable: false,
      };
    } catch (error) {
      console.error('AA06 activation invitation delivery failed', {
        code: error?.code,
        responseCode: error?.responseCode,
        command: error?.command,
      });
      return {
        deliveryStatus: 'FAILED',
        expiresAt: issued.expiresAt,
        retryable: true,
      };
    }
  }

  async #adminTransaction(actor, work) {
    const execute = async (tx) => {
      if (tx && this.activationLock)
        await this.activationLock.acquireMembershipLock(tx);
      const currentActor = found(
        await this.userRepository.findById(UserId.create(actor.sub), tx),
      );
      if (!currentActor.isActive() || !currentActor.hasRole('ADMINISTRATOR'))
        throw new AppError('Forbidden: Administrator role required', 403);
      return work(tx);
    };
    return this.unitOfWork
      ? this.unitOfWork.withTransaction(execute)
      : execute(undefined);
  }

  async #assertAnotherActiveAdministrator(excludedUserId, tx) {
    const queryable = tx ?? this.userRepository.database;
    if (queryable?.query) {
      const { rows } = await queryable.query(
        `SELECT count(*)::int AS count FROM users
         WHERE active AND 'ADMINISTRATOR' = ANY(roles) AND id <> $1`,
        [excludedUserId],
      );
      if (rows[0]?.count < 1)
        throw new AppError(
          'At least one active Administrator must remain',
          409,
        );
      return;
    }
    const activeUsers = await this.userRepository.findAll();
    if (
      !activeUsers.some(
        (user) =>
          user.getId().getValue() !== excludedUserId &&
          user.isActive() &&
          user.hasRole('ADMINISTRATOR'),
      )
    )
      throw new AppError('At least one active Administrator must remain', 409);
  }
  /**
   * AA03 (BR 6, BR 7): only the token subject is trusted. The User is
   * reloaded on every protected request; the JWT "roles" claim is ignored.
   * Repository errors propagate (fail closed, BR 9).
   */
  async resolveActor(token) {
    let id;
    let claims;
    try {
      claims = this.tokenService.verifyToken(token);
      id = UserId.create(claims.sub);
    } catch {
      throw new AppError(INVALID_TOKEN, 401);
    }
    const user = await this.userRepository.findById(id);
    if (!user) throw new AppError(INVALID_TOKEN, 401);
    // Preserve the account-status response even though deactivation also
    // revokes sessions, and never let an inactive account reach a handler.
    this.assertCanAccess(user);
    if (this.sessions) {
      if (typeof claims.sid !== 'string') {
        throw new AppError(INVALID_TOKEN, 401);
      } else {
        const session = await this.sessions.findActive(claims.sid, claims.sub);
        if (!session) throw new AppError(INVALID_TOKEN, 401);
      }
    }
    return AuthenticatedActor.fromUser(user);
  }

  /** GDP01 (G4, GDPR Art. 7(3)): the user gives or withdraws marketing consent. */
  async updateOwnMarketingConsent(actor, given) {
    if (!actor) throw new AppError('Authentication required', 401);
    const user = await this.userRepository.findById(UserId.create(actor.sub));
    if (!user) throw new AppError(INVALID_TOKEN, 401);
    this.assertCanAccess(user);
    if (user.getMarketingConsent().isGiven() !== given)
      user.updateMarketingConsent(MarketingConsent.create(given, new Date()));
    return UserResponseMapper.toDTO(await this.userRepository.save(user));
  }
  /**
   * AA03 (D6): GET /auth/me. The account is reloaded and re-validated,
   * because it may change after resolveActor() ran.
   */
  async getCurrentUser(actor) {
    if (!actor) throw new AppError('Authentication required', 401);
    const user = await this.userRepository.findById(UserId.create(actor.sub));
    if (!user) throw new AppError(INVALID_TOKEN, 401);
    this.assertCanAccess(user);
    return UserResponseMapper.toDTO(user);
  }
}
