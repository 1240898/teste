import { AppError } from '../../../../shared/errors/AppError.js';

export const UserRole = Object.freeze({
  ADMINISTRATOR: 'ADMINISTRATOR',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  CUSTOMER: 'CUSTOMER',
});
// AA03: the only role assigned automatically, by the back end, to every new account.
export const DEFAULT_ROLES = Object.freeze([UserRole.CUSTOMER]);
const invalid = (message) => {
  throw new AppError(message);
};
export class UserId {
  #value;
  constructor(value) {
    if (typeof value !== 'string' || !/^USR-\d{5,}$/i.test(value.trim()))
      invalid('Invalid user id');
    this.#value = value.trim().toUpperCase();
    Object.freeze(this);
  }
  static create(id) {
    return new UserId(id);
  }
  getValue() {
    return this.#value;
  }
  equals(other) {
    return other instanceof UserId && this.#value === other.getValue();
  }
}
export class UserName {
  #name;
  constructor(name) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100)
      invalid('Name must contain 1 to 100 characters');
    this.#name = name.trim();
    Object.freeze(this);
  }
  static create(name) {
    return new UserName(name);
  }
  getValue() {
    return this.#name;
  }
}
export class Email {
  #emailAddress;
  constructor(email) {
    if (typeof email !== 'string') invalid('Invalid email');
    const normalized = email.trim().toLowerCase();
    if (
      normalized.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    )
      invalid('Invalid email');
    this.#emailAddress = normalized;
    Object.freeze(this);
  }
  static create(email) {
    return new Email(email);
  }
  getValue() {
    return this.#emailAddress;
  }
  equals(other) {
    return other instanceof Email && this.#emailAddress === other.getValue();
  }
}
export class Password {
  #passwordHash;
  constructor(hash) {
    if (
      typeof hash !== 'string' ||
      !/^\$2[aby]\$(1[0-9]|2[0-9]|3[01])\$[./A-Za-z0-9]{53}$/.test(hash)
    )
      invalid('Invalid password hash');
    this.#passwordHash = hash;
    Object.freeze(this);
  }
  static createFromHash(hash) {
    return new Password(hash);
  }
  getHash() {
    return this.#passwordHash;
  }
  toJSON() {
    return undefined;
  }
}
export class MarketingConsent {
  #consentGiven;
  #timestamp;
  constructor(consentGiven, timestamp = new Date()) {
    if (
      typeof consentGiven !== 'boolean' ||
      !(timestamp instanceof Date) ||
      !Number.isFinite(timestamp.getTime())
    )
      invalid('Invalid marketing consent');
    this.#consentGiven = consentGiven;
    this.#timestamp = timestamp.getTime();
    Object.freeze(this);
  }
  static create(consentGiven, timestamp) {
    return new MarketingConsent(consentGiven, timestamp);
  }
  isGiven() {
    return this.#consentGiven;
  }
  getTimestamp() {
    return new Date(this.#timestamp);
  }
}
// AA02: external identity providers supported for sign-in.
export const IdentityProvider = Object.freeze({
  GOOGLE: 'GOOGLE',
});

/**
 * AA02: link between a User and one identity at an external provider.
 * The subject is the provider's stable user identifier (OIDC "sub" claim),
 * never the e-mail. No password or provider token is part of this value.
 */
export class ExternalIdentity {
  #provider;
  #subject;
  #linkedAt;
  constructor(provider, subject, linkedAt = new Date()) {
    if (!Object.values(IdentityProvider).includes(provider))
      invalid('Unsupported identity provider');
    if (
      typeof subject !== 'string' ||
      subject.length < 1 ||
      subject.length > 255 ||
      subject.trim() !== subject
    )
      invalid('Invalid external identity subject');
    if (!(linkedAt instanceof Date) || !Number.isFinite(linkedAt.getTime()))
      invalid('Invalid external identity link date');
    this.#provider = provider;
    this.#subject = subject;
    this.#linkedAt = linkedAt.getTime();
    Object.freeze(this);
  }
  static create(provider, subject, linkedAt) {
    return new ExternalIdentity(provider, subject, linkedAt);
  }
  getProvider() {
    return this.#provider;
  }
  getSubject() {
    return this.#subject;
  }
  getLinkedAt() {
    return new Date(this.#linkedAt);
  }
  equals(other) {
    return (
      other instanceof ExternalIdentity &&
      other.getProvider() === this.#provider &&
      other.getSubject() === this.#subject
    );
  }
}

// AA03: roles are 0..* (an Administrator may remove every role); an account
// without roles exists but cannot access protected functionality.
export function normalizeRoles(roles) {
  if (
    !Array.isArray(roles) ||
    roles.some((role) => !Object.values(UserRole).includes(role))
  )
    invalid('Only supported roles are allowed');
  return [...new Set(roles)];
}
