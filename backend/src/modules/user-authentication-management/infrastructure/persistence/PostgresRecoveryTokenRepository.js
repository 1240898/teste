import { RecoveryTokenCandidate } from '../../application/readModels/RecoveryTokenCandidate.js';

export class PostgresRecoveryTokenRepository {
  constructor(database) {
    this.database = database;
  }

  async replaceActive(userId, tokenHash, expiresAt, tx) {
    const account = await tx.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if (!account.rows[0]) return false;

    await tx.query(
      `UPDATE password_recovery_tokens
       SET invalidated_at = now()
       WHERE user_id = $1 AND consumed_at IS NULL AND invalidated_at IS NULL`,
      [userId],
    );
    await tx.query(
      `INSERT INTO password_recovery_tokens
       (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
    return true;
  }

  async findUsableForUpdate(tokenHash, tx) {
    // Read the owner without locking first, then acquire locks in the same
    // user-before-token order used by replaceActive(). Recheck after locking.
    const initial = await tx.query(
      `SELECT user_id
       FROM password_recovery_tokens
       WHERE token_hash = $1
         AND consumed_at IS NULL
         AND invalidated_at IS NULL
         AND expires_at > now()`,
      [tokenHash],
    );
    if (!initial.rows[0]) return null;

    const userId = initial.rows[0].user_id;
    const account = await tx.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if (!account.rows[0]) return null;

    const { rows } = await tx.query(
      `SELECT user_id
       FROM password_recovery_tokens
       WHERE token_hash = $1
         AND user_id = $2
         AND consumed_at IS NULL
         AND invalidated_at IS NULL
         AND expires_at > now()
       FOR UPDATE`,
      [tokenHash, userId],
    );
    return rows[0] ? new RecoveryTokenCandidate({ userId }) : null;
  }

  async consumeAndUpdatePassword(tokenHash, userId, passwordHash, tx) {
    const { rows } = await tx.query(
      `WITH consumed AS (
         UPDATE password_recovery_tokens
         SET consumed_at = now()
         WHERE token_hash = $1
           AND user_id = $2
           AND consumed_at IS NULL
           AND invalidated_at IS NULL
           AND expires_at > now()
         RETURNING user_id
       )
       UPDATE users AS account
       SET password_hash = $3, updated_at = now()
       FROM consumed
       WHERE account.id = consumed.user_id
       RETURNING account.id`,
      [tokenHash, userId, passwordHash],
    );
    return rows.length === 1;
  }
}
