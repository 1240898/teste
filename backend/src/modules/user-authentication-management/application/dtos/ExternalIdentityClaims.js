/**
 * AA02: identity claims taken from a validated provider ID token.
 * Keeps provider data out of the domain; never contains tokens or roles.
 */
export class ExternalIdentityClaims {
  constructor({ provider, subject, email, emailVerified, name = '' }) {
    this.provider = provider;
    this.subject = subject;
    this.email = email;
    this.emailVerified = emailVerified;
    this.name = name;
    Object.freeze(this);
  }
}