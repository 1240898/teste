import { User } from '../../domain/model/User.js';
import { AppError } from '../../../../shared/errors/AppError.js';
/** SQL row mapping only. HTTP response mapping lives in application. */
export class UserMapper {
  /**
   * @param row users row
   * @param identityRows user_external_identities rows of this user (AA02)
   */
  static toDomain(row, identityRows = []) {
    try {
      return User.restore({
        id: row.id,
        name: row.name,
        email: row.email,
        passwordHash: row.password_hash,
        externalIdentities: identityRows.map((identity) => ({
          provider: identity.provider,
          subject: identity.subject,
          linkedAt: identity.linked_at,
        })),
        roles: row.roles,
        active: row.active,
        everActivated: row.ever_activated ?? row.active,
        marketingConsent: row.marketing_consent_given,
        consentTimestamp: row.marketing_consent_timestamp,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch {
      // AA03 (D9): corrupted stored data (e.g. an unknown role) is a server
      // fault, never a client 400. errorHandler answers a sanitized 500 and
      // the request is denied (fail closed).
      throw new AppError('Invalid persisted account', 500);
    }
  }
  /** users row; password_hash is null for accounts without a local password. */
  static toPersistence(user) {
    return {
      id: user.getId().getValue(),
      name: user.getName().getValue(),
      email: user.getEmail().getValue(),
      password_hash: user.getPassword()?.getHash() ?? null,
      roles: user.getRoles(),
      active: user.isActive(),
      ever_activated: user.wasEverActivated(),
      marketing_consent_given: user.getMarketingConsent().isGiven(),
      marketing_consent_timestamp: user.getMarketingConsent().getTimestamp(),
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }
  /** AA02: user_external_identities rows of the aggregate. */
  static identitiesToPersistence(user) {
    return user.getExternalIdentities().map((identity) => ({
      user_id: user.getId().getValue(),
      provider: identity.getProvider(),
      subject: identity.getSubject(),
      linked_at: identity.getLinkedAt(),
    }));
  }
}
