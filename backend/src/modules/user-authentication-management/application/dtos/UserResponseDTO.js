/** Explicit allowlist for public account data; credentials are never copied. */
export class UserResponseDTO {
  constructor({
    id,
    name,
    email,
    roles,
    active,
    everActivated,
    activationMethod = null,
    marketingConsent,
    createdAt,
  }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.roles = [...roles];
    this.active = active;
    this.everActivated = everActivated;
    this.activationMethod = activationMethod;
    this.marketingConsent = marketingConsent;
    this.createdAt = createdAt;
  }
}
