export class PostgresApplicationSessionRepository {
  constructor(database) {
    this.database = database;
  }

  async create({ id, userId, hash, csrfToken, idleSeconds }) {
    const { rows } = await this.database.query(
      `INSERT INTO application_sessions (id, user_id, credential_hash, csrf_token, idle_expires_at)
       VALUES ($1, $2, $3, $4, clock_timestamp() + ($5 * interval '1 second'))
       RETURNING id, user_id, created_at, idle_expires_at`,
      [id, userId, hash, csrfToken, idleSeconds],
    );
    return rows[0];
  }

  async findActive(id, userId) {
    const { rows } = await this.database.query(
      `SELECT s.id, s.user_id, s.csrf_token FROM application_sessions s
       WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL
       AND s.idle_expires_at > clock_timestamp()`,
      [id, userId],
    );
    return rows[0] ?? null;
  }

  async findByCredential(id, credentialHash) {
    const { rows } = await this.database.query(
      `SELECT id, user_id, csrf_token, revoked_at, created_at, idle_expires_at FROM application_sessions
       WHERE id = $1 AND credential_hash = $2`,
      [id, credentialHash],
    );
    return rows[0] ?? null;
  }

  async findResumable(id, credentialHash) {
    const { rows } = await this.database.query(
      `SELECT id, user_id, csrf_token, created_at, idle_expires_at FROM application_sessions
       WHERE id = $1 AND credential_hash = $2 AND revoked_at IS NULL
       AND idle_expires_at > clock_timestamp()`,
      [id, credentialHash],
    );
    return rows[0] ?? null;
  }

  async renew(id, credentialHash, csrfToken, replacement, idleSeconds) {
    return this.database.withTransaction(async (db) => {
      const { rows } = await db.query(
        `SELECT id FROM application_sessions WHERE id = $1 AND credential_hash = $2
         AND csrf_token = $3 AND revoked_at IS NULL
         AND idle_expires_at > clock_timestamp() FOR UPDATE`,
        [id, credentialHash, csrfToken],
      );
      if (!rows[0]) return null;
      const { rows: renewed } = await db.query(
        `UPDATE application_sessions SET id = $1, credential_hash = $2,
         csrf_token = $3, last_activity_at = clock_timestamp(),
         idle_expires_at = clock_timestamp() + ($6 * interval '1 second')
         WHERE id = $4 AND credential_hash = $5 AND csrf_token = $7
         AND revoked_at IS NULL AND idle_expires_at > clock_timestamp()
         RETURNING id, user_id, created_at, idle_expires_at`,
        [
          replacement.id,
          replacement.hash,
          replacement.csrfToken,
          id,
          credentialHash,
          idleSeconds,
          csrfToken,
        ],
      );
      return renewed[0] ?? null;
    });
  }

  async revoke(id, credentialHash, csrfToken) {
    return this.database.withTransaction(async (db) => {
      const { rows } = await db.query(
        `SELECT id, revoked_at FROM application_sessions WHERE id = $1 AND credential_hash = $2
         AND csrf_token = $3 FOR UPDATE`,
        [id, credentialHash, csrfToken],
      );
      if (!rows[0]) return false;
      if (rows[0].revoked_at) return true;
      await db.query(
        `UPDATE application_sessions SET revoked_at = clock_timestamp()
         WHERE id = $1 AND credential_hash = $2`,
        [id, credentialHash],
      );
      return true;
    });
  }

  async revokeAllForUser(userId, queryable = this.database) {
    await queryable.query(
      `UPDATE application_sessions SET revoked_at = clock_timestamp()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  async purgeEnded(retentionSeconds) {
    await this.database.query(
      `DELETE FROM application_sessions WHERE COALESCE(revoked_at, idle_expires_at) < clock_timestamp() - ($1 * interval '1 second')`,
      [retentionSeconds],
    );
  }
}
