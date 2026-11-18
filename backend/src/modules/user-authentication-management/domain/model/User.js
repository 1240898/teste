import {
  Email,
  UserId,
  UserName,
  Password,
  MarketingConsent,
  ExternalIdentity,
  normalizeRoles,
  DEFAULT_ROLES,
} from './values.js';

import { AppError } from '../../../../shared/errors/AppError.js';
import {
  ActivationCredential,
  ActivationInvitation,
  ACTIVATION_PASSWORD_CONFLICT,
  ACTIVATION_PASSWORD_REQUIRED,
  EXTERNAL_AUTH_FAILED,
  invitationUnavailable,
} from './ActivationInvitation.js';

// AA02 BR 13: at most one external identity per provider.
function normalizeIdentities(identities) {
  if (
    !Array.isArray(identities) ||
    identities.some((identity) => !(identity instanceof ExternalIdentity))
  )
    throw new AppError('Invalid account state');
  const providers = identities.map((identity) => identity.getProvider());
  if (new Set(providers).size !== providers.length)
    throw new AppError('Invalid account state');
  return [...identities];
}

export class User {
  #id;
  #name;
  #email;
  #password;
  #externalIdentities;
  #roles;
  #marketingConsent;
  #active;
  #everActivated;
  #createdAt;
  #updatedAt;
  constructor({
    id,
    name,
    email,
    password,
    externalIdentities = [],
    roles,
    marketingConsent,
    active,
    everActivated = active,
    createdAt,
    updatedAt,
  }) {
    if (
      !(id instanceof UserId) ||
      !(name instanceof UserName) ||
      !(email instanceof Email) ||
      // AA02 (D2): the local password is optional (external-only or invited accounts).
      (password !== null && !(password instanceof Password)) ||
      !(marketingConsent instanceof MarketingConsent) ||
      typeof active !== 'boolean' ||
      typeof everActivated !== 'boolean' ||
      (active && !everActivated) ||
      ![createdAt, updatedAt].every(
        (date) => date instanceof Date && Number.isFinite(date.getTime()),
      )
    )
      throw new AppError('Invalid account state');
    const identities = normalizeIdentities(externalIdentities);
    // AA02 BR 12: an active account must have at least one credential.
    if (active && password === null && identities.length === 0)
      throw new AppError('Invalid account state');

    this.#id = id;
    this.#name = name;
    this.#email = email;
    this.#password = password;
    this.#externalIdentities = identities;
    this.#roles = normalizeRoles(roles);
    this.#marketingConsent = marketingConsent;
    this.#active = active;
    this.#everActivated = everActivated;
    this.#createdAt = createdAt.getTime();
    this.#updatedAt = updatedAt.getTime();
    Object.freeze(this);
  }
  // AA03: roles are not a creation input. Every new account receives exactly
  // DEFAULT_ROLES ([CUSTOMER]); other roles are added later through addRole()
  // by an Administrator (AA06) or by the bootstrap command.
  static create(id, name, email, password, consent) {
    const now = new Date();
    return new User({
      id,
      name,
      email,
      password,
      roles: [...DEFAULT_ROLES],
      marketingConsent: consent,
      active: true,
      everActivated: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  /** AA06: local registration waits for invitation activation. */
  static createInactive(id, name, email, password, consent) {
    const now = new Date();
    return new User({
      id,
      name,
      email,
      password,
      roles: [...DEFAULT_ROLES],
      marketingConsent: consent,
      active: false,
      everActivated: false,
      createdAt: now,
      updatedAt: now,
    });
  }
  /**
   * AA02 BR 9 (client clarification Q2): the first successful external sign-in of
   * an unknown identity creates an active account with only CUSTOMER (AA03),
   * no local password and no marketing consent (AA07).
   */
  static createFromExternalIdentity(id, name, email, identity, consent) {
    if (!(identity instanceof ExternalIdentity))
      throw new AppError('Invalid external identity');
    if (!(consent instanceof MarketingConsent) || consent.isGiven())
      throw new AppError('External sign-in cannot grant marketing consent');
    const now = new Date();
    return new User({
      id,
      name,
      email,
      password: null,
      externalIdentities: [identity],
      // AA03 (BR 1): same automatic role as every other new account.
      roles: [...DEFAULT_ROLES],
      marketingConsent: consent,
      active: true,
      everActivated: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore({
    id,
    name,
    email,
    passwordHash,
    externalIdentities = [],
    roles,
    marketingConsent,
    consentTimestamp,
    active,
    everActivated = active,
    createdAt,
    updatedAt,
  }) {
    if (typeof id !== 'string' || !(consentTimestamp instanceof Date))
      throw new AppError('Invalid persisted account');
    if (!Array.isArray(externalIdentities))
      throw new AppError('Invalid persisted account');
    return new User({
      id: UserId.create(id),
      name: UserName.create(name),
      email: Email.create(email),
      // null = no local password; undefined or malformed hashes are rejected.
      password:
        passwordHash === null ? null : Password.createFromHash(passwordHash),
      externalIdentities: externalIdentities.map(
        ({ provider, subject, linkedAt }) =>
          ExternalIdentity.create(provider, subject, linkedAt),
      ),
      roles,
      marketingConsent: MarketingConsent.create(
        marketingConsent,
        consentTimestamp,
      ),
      active,
      everActivated,
      createdAt,
      updatedAt,
    });
  }
  getId() {
    return this.#id;
  }
  getName() {
    return this.#name;
  }
  getEmail() {
    return this.#email;
  }
  getPassword() {
    return this.#password;
  }
  hasLocalPassword() {
    return this.#password !== null;
  }
  getExternalIdentities() {
    return [...this.#externalIdentities];
  }
  hasExternalIdentity(provider, subject) {
    return this.#externalIdentities.some(
      (identity) =>
        identity.getProvider() === provider &&
        identity.getSubject() === subject,
    );
  }
  /** AA02 BR 12: a local password and/or an external identity. */
  hasCredential() {
    return this.hasLocalPassword() || this.#externalIdentities.length > 0;
  }
  /** AA02 D9 / AA03: an account without roles cannot start a session. */
  hasActiveRole() {
    return this.#roles.length > 0;
  }
  /** AA03 (BR 8): protected functionality requires an active account with at least one role. */
  canAccess() {
    return this.#active && this.hasActiveRole();
  }
  getRoles() {
    return [...this.#roles];
  }
  getMarketingConsent() {
    return this.#marketingConsent;
  }
  isActive() {
    return this.#active;
  }
  wasEverActivated() {
    return this.#everActivated;
  }
  get createdAt() {
    return new Date(this.#createdAt);
  }
  get updatedAt() {
    return new Date(this.#updatedAt);
  }
  hasRole(role) {
    return this.#roles.includes(role);
  }
  addRole(role) {
    this.setRoles([...this.#roles, role]);
  }
  removeRole(role) {
    this.setRoles(this.#roles.filter((current) => current !== role));
  }
  setRoles(roles) {
    const next = normalizeRoles(roles);
    if (
      next.length !== this.#roles.length ||
      next.some((role) => !this.hasRole(role))
    ) {
      this.#roles = next;
      this.#updatedAt = Date.now();
    }
  }
  changePassword(password) {
    if (!(password instanceof Password)) throw new AppError('Invalid password');
    this.#password = password;
    this.#updatedAt = Date.now();
  }

  /**
   * AA02 (used by AA07): links an external identity without changing roles or
   * the active state. Linking the same identity again has no effect.
   */
  linkExternalIdentity(identity) {
    if (!(identity instanceof ExternalIdentity))
      throw new AppError('Invalid external identity');
    if (this.#externalIdentities.some((current) => current.equals(identity)))
      return;
    if (
      this.#externalIdentities.some(
        (current) => current.getProvider() === identity.getProvider(),
      )
    )
      throw new AppError('Only one external identity per provider is allowed');
    this.#externalIdentities = [...this.#externalIdentities, identity];
    this.#updatedAt = Date.now();
  }

  updateMarketingConsent(consent) {
    if (!(consent instanceof MarketingConsent))
      throw new AppError('Invalid marketing consent');
    this.#marketingConsent = consent;
    this.#updatedAt = Date.now();
  }
  deactivate() {
    if (this.#active) {
      this.#active = false;
      this.#updatedAt = Date.now();
    }
  }
  activate() {
    if (!this.#active) {
      // AA02 BR 12: invited accounts (AA06) must first receive a credential (AA07).
      if (!this.hasCredential())
        throw new AppError(
          'An account without credentials cannot be activated',
        );
      if (!this.#everActivated)
        throw new AppError('Invitation activation is required');
      this.#active = true;
      this.#everActivated = true;
      this.#updatedAt = Date.now();
    }
  }

  activateByInvitation() {
    if (this.#everActivated || this.#active)
      throw new AppError('Account cannot be activated by invitation');
    if (!this.hasCredential())
      throw new AppError('An account without credentials cannot be activated');
    this.#active = true;
    this.#everActivated = true;
    this.#updatedAt = Date.now();
  }

  redeemInvitation(invitation, credential, now) {
    if (
      !(invitation instanceof ActivationInvitation) ||
      !(credential instanceof ActivationCredential)
    )
      throw new TypeError('Invalid invitation redemption input');
    if (this.#active || this.#everActivated) throw invitationUnavailable();
    invitation.assertRedeemable(this.#id, this.#email, credential.method, now);

    if (credential.method === 'LOCAL') {
      if (!this.#password && !credential.password)
        throw new AppError(ACTIVATION_PASSWORD_REQUIRED, 400);
      if (this.#password && credential.password)
        throw new AppError(ACTIVATION_PASSWORD_CONFLICT, 409);
      this.#password ??= credential.password;
    } else {
      if (
        !credential.verifiedEmail.equals(invitation.intendedEmail) ||
        !credential.verifiedEmail.equals(this.#email)
      )
        throw new AppError(EXTERNAL_AUTH_FAILED, 401);
      const linked = this.#externalIdentities.find(
        (identity) =>
          identity.getProvider() === credential.identity.getProvider(),
      );
      if (linked && !linked.equals(credential.identity))
        throw new AppError('External identity already linked', 409);
      if (!linked)
        this.#externalIdentities = [
          ...this.#externalIdentities,
          credential.identity,
        ];
    }

    this.#active = true;
    this.#everActivated = true;
    this.#updatedAt = now.getTime();
    invitation.markUsed();
  }
}
