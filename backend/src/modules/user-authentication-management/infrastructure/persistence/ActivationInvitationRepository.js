export class ActivationInvitationRepository {
  constructor(database) {
    this.database = database;
  }

  async replacePending(
    { userId, email, tokenHash, expiresAt, activationMethod },
    tx,
  ) {
    if (!['LOCAL', 'EXTERNAL'].includes(activationMethod))
      throw new TypeError('Activation method must be LOCAL or EXTERNAL');
    await tx.query(
      `UPDATE activation_invitations SET status = CASE
         WHEN expires_at <= clock_timestamp() THEN 'EXPIRED' ELSE 'INVALIDATED' END
       WHERE user_id = $1 AND status = 'PENDING'`,
      [userId],
    );
    await tx.query(
      `INSERT INTO activation_invitations
       (token_hash, user_id, intended_email, expires_at, status, activation_method)
       VALUES ($1,$2,$3,$4,'PENDING',$5)`,
      [
        Buffer.from(tokenHash, 'hex'),
        userId,
        email,
        expiresAt,
        activationMethod,
      ],
    );
  }

  async findLatestMethodForUpdate(userId, tx) {
    const { rows } = await tx.query(
      `SELECT activation_method FROM activation_invitations
       WHERE user_id = $1 ORDER BY created_at DESC, expires_at DESC
       LIMIT 1 FOR UPDATE`,
      [userId],
    );
    return rows[0]?.activation_method ?? null;
  }

  async findLatestMethodsForUsers(userIds) {
    if (userIds.length === 0) return new Map();
    const { rows } = await this.database.query(
      `SELECT DISTINCT ON (user_id) user_id, activation_method
       FROM activation_invitations
       WHERE user_id = ANY($1::varchar[])
       ORDER BY user_id, created_at DESC, expires_at DESC`,
      [userIds],
    );
    return new Map(
      rows.map(({ user_id, activation_method }) => [
        user_id,
        activation_method,
      ]),
    );
  }

  async findUsableForUpdate(tokenHash, tx) {
    const { rows } = await tx.query(
      `SELECT user_id, intended_email, activation_method FROM activation_invitations
       WHERE token_hash = $1 AND status = 'PENDING' AND expires_at > clock_timestamp()
       FOR UPDATE`,
      [Buffer.from(tokenHash, 'hex')],
    );
    return rows[0] ?? null;
  }

  async findEligibleBinding(tokenHash) {
    const { rows } = await this.database.query(
      `SELECT i.user_id, i.activation_method
       FROM activation_invitations AS i JOIN users AS u ON u.id = i.user_id
       WHERE i.token_hash = $1 AND i.status = 'PENDING'
         AND i.expires_at > clock_timestamp() AND i.activation_method IS NOT NULL
         AND NOT u.active AND NOT u.ever_activated AND i.intended_email = u.email`,
      [Buffer.from(tokenHash, 'hex')],
    );
    const row = rows[0];
    return row
      ? { tokenHash, userId: row.user_id, method: row.activation_method }
      : null;
  }

  async loadForRedemption(tokenHash, userId, tx) {
    const { rows } = await tx.query(
      `SELECT user_id, intended_email, activation_method, status, expires_at
       FROM activation_invitations WHERE token_hash = $1 AND user_id = $2 FOR UPDATE`,
      [Buffer.from(tokenHash, 'hex'), userId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      intendedEmail: row.intended_email,
      method: row.activation_method,
      status: row.status,
      expiresAt: row.expires_at,
    };
  }

  async consume(tokenHash, userId, tx) {
    const { rows } = await tx.query(
      `UPDATE activation_invitations SET status = 'USED'
       WHERE token_hash = $1 AND user_id = $2 AND status = 'PENDING'
         AND expires_at > clock_timestamp() RETURNING token_hash`,
      [Buffer.from(tokenHash, 'hex'), userId],
    );
    return rows.length === 1;
  }
}
