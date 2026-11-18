export class InMemoryApplicationSessionRepository {
  constructor() {
    this.records = new Map();
  }
  async create(session) {
    const record = {
      id: session.id,
      user_id: session.userId,
      csrf_token: session.csrfToken,
      credential_hash: session.hash,
      revoked_at: null,
      created_at: new Date(),
      idle_expires_at: new Date(Date.now() + session.idleSeconds * 1000),
    };
    this.records.set(record.id, record);
    return record;
  }
  registerTestSession(id, userId, idleSeconds) {
    this.records.set(id, {
      id,
      user_id: userId,
      csrf_token: Buffer.alloc(32),
      credential_hash: Buffer.alloc(32),
      revoked_at: null,
      created_at: new Date(),
      idle_expires_at: new Date(Date.now() + idleSeconds * 1000),
    });
  }
  async findByCredential(id, hash) {
    const record = this.records.get(id);
    return record && Buffer.compare(record.credential_hash, hash) === 0
      ? record
      : null;
  }
  async findResumable(id, hash) {
    const record = await this.findByCredential(id, hash);
    return record && !record.revoked_at && record.idle_expires_at > new Date()
      ? record
      : null;
  }
  async findActive(id, userId) {
    const record = this.records.get(id);
    return record?.user_id === userId &&
      !record.revoked_at &&
      record.idle_expires_at > new Date()
      ? record
      : null;
  }
  async renew(id, hash, csrfHash, replacement, idleSeconds) {
    const record = await this.findByCredential(id, hash);
    if (
      !record ||
      record.revoked_at ||
      Buffer.compare(record.csrf_token, csrfHash) !== 0 ||
      record.idle_expires_at <= new Date()
    )
      return null;
    this.records.delete(id);
    const now = Date.now();
    record.id = replacement.id;
    record.credential_hash = replacement.hash;
    record.csrf_token = replacement.csrfToken;
    record.last_activity_at = new Date(now);
    record.idle_expires_at = new Date(now + idleSeconds * 1000);
    this.records.set(record.id, record);
    return record;
  }
  async revoke(id, hash, csrfHash) {
    const record = await this.findByCredential(id, hash);
    if (!record || Buffer.compare(record.csrf_token, csrfHash) !== 0)
      return false;
    record.revoked_at ??= new Date();
    return true;
  }
  async purgeEnded() {}

  async revokeAllForUser(userId) {
    const now = new Date();
    for (const record of this.records.values())
      if (record.user_id === userId && !record.revoked_at)
        record.revoked_at = now;
  }
}
