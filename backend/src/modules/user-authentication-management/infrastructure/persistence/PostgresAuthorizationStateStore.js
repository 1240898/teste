import { createHash } from 'node:crypto';

function digest(state) {
  return createHash('sha256').update(state).digest();
}

export class PostgresAuthorizationStateStore {
  constructor(database, { ttlMs = 10 * 60 * 1000 } = {}) {
    Object.assign(this, { database, ttlMs });
  }

  async save(state, { provider, purpose, nonce, codeVerifier, binding }) {
    await this.purgeExpired();
    await this.database.query(
      `INSERT INTO oauth_authorization_states
         (state_hash, purpose, provider, nonce, code_verifier, expires_at, invitation_hash, invitation_user_id)
       VALUES ($1, $2, $3, $4, $5, clock_timestamp() + $6 * interval '1 millisecond', $7, $8)`,
      [
        digest(state),
        purpose,
        provider,
        nonce,
        codeVerifier,
        this.ttlMs,
        binding ? Buffer.from(binding.tokenHash, 'hex') : null,
        binding?.userId ?? null,
      ],
    );
  }

  async consume(state, purpose) {
    const { rows } = await this.database.query(
      `DELETE FROM oauth_authorization_states
       WHERE state_hash = $1 AND purpose = $2 AND expires_at > clock_timestamp()
       RETURNING provider, purpose, nonce, code_verifier, invitation_hash, invitation_user_id`,
      [digest(state), purpose],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      provider: row.provider,
      purpose: row.purpose,
      nonce: row.nonce,
      codeVerifier: row.code_verifier,
      binding: row.invitation_hash
        ? {
            tokenHash: row.invitation_hash.toString('hex'),
            userId: row.invitation_user_id,
            method: 'EXTERNAL',
          }
        : undefined,
    };
  }

  async purgeExpired() {
    await this.database.query(
      'DELETE FROM oauth_authorization_states WHERE expires_at <= clock_timestamp()',
    );
  }
}
