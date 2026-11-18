import { UserMapper } from './UserMapper.js';
import { AppError } from '../../../../shared/errors/AppError.js';
const columns =
  'id, name, email, password_hash, roles, active, ever_activated, marketing_consent_given, marketing_consent_timestamp, created_at, updated_at';
const userColumns = columns
  .split(', ')
  .map((column) => `u.${column}`)
  .join(', ');
const identityColumns = 'user_id, provider, subject, linked_at';
const mutableColumns = [
  'roles',
  'active',
  'ever_activated',
  'marketing_consent_given',
  'marketing_consent_timestamp',
];
const identityConstraints = new Set([
  'user_external_identities_pkey',
  'user_external_identities_user_provider_key',
]);
const identityKey = (identity) =>
  `${identity.provider}\u0000${identity.subject}`;

export class UserRepository {
  #snapshots = new WeakMap();
  constructor(database) {
    this.database = database;
  }
  async nextId(tx = null) {
    const { rows } = await (tx ?? this.database).query(
      "SELECT 'USR-' || CASE WHEN length(n::text) < 5 THEN lpad(n::text, 5, '0') ELSE n::text END AS id FROM (SELECT nextval('user_id_seq') AS n) generated",
    );
    return rows[0].id;
  }
  #remember(row, identityRows = []) {
    const user = UserMapper.toDomain(row, identityRows);
    this.#snapshot(user);
    return user;
  }
  #snapshot(user) {
    this.#snapshots.set(user, {
      row: UserMapper.toPersistence(user),
      identities: new Set(
        UserMapper.identitiesToPersistence(user).map(identityKey),
      ),
    });
  }
  // AA02: every finder returns complete aggregates, so identities are loaded for
  // all returned users with one extra query (no query per user in findAll).
  async #hydrate(rows, queryable = this.database) {
    if (rows.length === 0) return [];
    const { rows: identityRows } = await queryable.query(
      `SELECT ${identityColumns} FROM user_external_identities WHERE user_id = ANY($1::varchar[]) ORDER BY linked_at, provider`,
      [rows.map((row) => row.id)],
    );
    const byUser = new Map();
    for (const identity of identityRows) {
      if (!byUser.has(identity.user_id)) byUser.set(identity.user_id, []);
      byUser.get(identity.user_id).push(identity);
    }
    return rows.map((row) => this.#remember(row, byUser.get(row.id) ?? []));
  }
  async findById(id, tx) {
    const queryable = tx ?? this.database;
    const lock = tx ? ' FOR UPDATE' : '';
    const { rows } = await queryable.query(
      `SELECT ${columns} FROM users WHERE id = $1${lock}`,
      [id.getValue()],
    );
    return (await this.#hydrate(rows, queryable))[0] ?? null;
  }
  async findByEmail(email, tx = null) {
    const queryable = tx ?? this.database;
    const lock = tx ? ' FOR UPDATE' : '';
    const { rows } = await queryable.query(
      `SELECT ${columns} FROM users WHERE email = $1${lock}`,
      [email.getValue()],
    );
    return (await this.#hydrate(rows, queryable))[0] ?? null;
  }
  /** AA02: the user linked to (provider, subject), the external identity key. */
  async findByExternalIdentity(provider, subject) {
    if (typeof provider !== 'string' || typeof subject !== 'string')
      return null;
    const { rows } = await this.database.query(
      `SELECT ${userColumns} FROM users u JOIN user_external_identities i ON i.user_id = u.id WHERE i.provider = $1 AND i.subject = $2`,
      [provider, subject],
    );
    return (await this.#hydrate(rows))[0] ?? null;
  }
  async existsByEmail(email) {
    const { rows } = await this.database.query(
      'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) AS exists',
      [email.getValue()],
    );
    return rows[0].exists;
  }
  async findAll({ includeInactive = false } = {}) {
    const { rows } = await this.database.query(
      `SELECT ${columns} FROM users WHERE ($1::boolean OR active = true) ORDER BY created_at, id`,
      [includeInactive],
    );
    return this.#hydrate(rows);
  }
  // Writes that include identity rows run in one transaction. A repository built
  // on a transaction client (e.g. bootstrapManager) is already transactional.
  #write(needsTransaction, work, tx = null) {
    if (tx) return work(tx);
    return needsTransaction &&
      typeof this.database.withTransaction === 'function'
      ? this.database.withTransaction(work)
      : work(this.database);
  }
  save(user, tx = null) {
    return this.#save(user, tx, mutableColumns);
  }

  saveActivation(user, tx) {
    if (!tx || !this.#snapshots.has(user))
      throw new TypeError(
        'Activation requires a locked account and transaction',
      );
    return this.#save(user, tx, ['active', 'ever_activated', 'password_hash']);
  }

  async #save(user, tx, updateColumns) {
    const row = UserMapper.toPersistence(user);
    const identities = UserMapper.identitiesToPersistence(user);
    const previous = this.#snapshots.get(user);
    try {
      if (!previous) {
        // Newly created aggregates are inserted with their identities.
        await this.#write(
          identities.length > 0,
          async (db) => {
            const keys = Object.keys(row);
            await db.query(
              `INSERT INTO users (${keys.join(', ')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(', ')})`,
              Object.values(row),
            );
            for (const identity of identities)
              await db.query(
                `INSERT INTO user_external_identities (${identityColumns}) VALUES ($1, $2, $3, $4)`,
                Object.values(identity),
              );
          },
          tx,
        );
      } else {
        // Track loaded state so role updates cannot overwrite concurrent deactivation.
        const changed = updateColumns.filter(
          (key) =>
            JSON.stringify(row[key]) !== JSON.stringify(previous.row[key]),
        );
        // AA02: identities linked after loading (e.g. by AA07) are inserted.
        const linked = identities.filter(
          (identity) => !previous.identities.has(identityKey(identity)),
        );
        if (changed.length > 0 || linked.length > 0)
          await this.#write(
            linked.length > 0,
            async (db) => {
              if (changed.length > 0) {
                const values = [row.id, ...changed.map((key) => row[key])];
                const assignments = changed.map(
                  (key, index) => `${key} = $${index + 2}`,
                );
                const result = await db.query(
                  `UPDATE users SET ${assignments.join(', ')}, updated_at = now() WHERE id = $1 RETURNING id`,
                  values,
                );
                if (!result.rows[0]) throw new AppError('User not found', 404);
              }
              for (const identity of linked) await this.#link(db, identity);
            },
            tx,
          );
      }
      const current = await this.findById(user.getId(), tx);
      if (!current) throw new AppError('User not found', 404);
      this.#snapshot(user);
      return current;
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'users_email_key')
        throw new AppError('Email already registered', 409);
      if (error.code === '23505' && identityConstraints.has(error.constraint))
        throw new AppError('External identity already linked', 409);
      if (
        error.code === '23503' &&
        error.constraint === 'user_external_identities_user_id_fkey'
      )
        throw new AppError('User not found', 404);
      throw error;
    }
  }

  async updatePasswordIfCurrent(id, expectedHash, replacementHash, tx) {
    const queryable = tx ?? this.database;
    const { rows } = await queryable.query(
      `UPDATE users
       SET password_hash = $3, updated_at = now()
       WHERE id = $1 AND password_hash = $2 AND active = true
       RETURNING id`,
      [id.getValue(), expectedHash, replacementHash],
    );
    return rows.length === 1;
  }
  // An identity already linked to this same user (stale aggregate) is not
  // duplicated; one linked to another user is a conflict.
  async #link(db, identity) {
    const inserted = await db.query(
      `INSERT INTO user_external_identities (${identityColumns}) VALUES ($1, $2, $3, $4) ON CONFLICT (provider, subject) DO NOTHING RETURNING user_id`,
      Object.values(identity),
    );
    if (inserted.rows[0]) return;
    const { rows } = await db.query(
      'SELECT user_id FROM user_external_identities WHERE provider = $1 AND subject = $2',
      [identity.provider, identity.subject],
    );
    if (rows[0]?.user_id !== identity.user_id)
      throw new AppError('External identity already linked', 409);
  }
}
