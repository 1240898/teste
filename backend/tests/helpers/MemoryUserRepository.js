import { AppError } from '../../src/shared/errors/AppError.js';
import { UserMapper } from '../../src/modules/user-authentication-management/infrastructure/persistence/UserMapper.js';
// Rows keep the users columns plus external_identities (AA02) for test assertions.
const toDomain = (row) => UserMapper.toDomain(row, row.external_identities);
export class MemoryUserRepository {
  users = new Map();
  #nextSequence = 1;
  async nextId() {
    return `USR-${String(this.#nextSequence++).padStart(5, '0')}`;
  }
  async findById(id) {
    const row = this.users.get(id.getValue());
    return row ? toDomain(row) : null;
  }
  async findByEmail(email) {
    const row = [...this.users.values()].find(
      (u) => u.email === email.getValue(),
    );
    return row ? toDomain(row) : null;
  }
  async findByExternalIdentity(provider, subject) {
    const row = [...this.users.values()].find((u) =>
      u.external_identities.some(
        (i) => i.provider === provider && i.subject === subject,
      ),
    );
    return row ? toDomain(row) : null;
  }
  async existsByEmail(email) {
    return Boolean(await this.findByEmail(email));
  }
  async findAll({ includeInactive = false } = {}) {
    return [...this.users.values()]
      .filter((u) => includeInactive || u.active)
      .map((row) => toDomain(row));
  }
  async save(user) {
    const row = UserMapper.toPersistence(user);
    const identities = UserMapper.identitiesToPersistence(user);
    const others = [...this.users.values()].filter((u) => u.id !== row.id);
    if (others.some((u) => u.email === row.email))
      throw new AppError('Email already registered', 409);
    if (
      others.some((u) =>
        u.external_identities.some((i) =>
          identities.some(
            (n) => n.provider === i.provider && n.subject === i.subject,
          ),
        ),
      )
    )
      throw new AppError('External identity already linked', 409);
    const stored = { ...row, external_identities: identities };
    this.users.set(row.id, stored);
    return toDomain(stored);
  }
  async updatePasswordIfCurrent(id, expectedHash, replacementHash) {
    const row = this.users.get(id.getValue());
    if (!row || !row.active || row.password_hash !== expectedHash) return false;
    this.users.set(id.getValue(), { ...row, password_hash: replacementHash });
    return true;
  }
}
