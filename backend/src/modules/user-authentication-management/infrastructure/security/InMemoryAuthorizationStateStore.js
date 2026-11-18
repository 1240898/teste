/**
 * AA02 (decision D4): pending OIDC authorizations kept in process memory.
 * Entries are single use and expire after ttlMs (10 minutes by default).
 * maxEntries bounds memory use; the oldest pending entry is dropped first.
 * Limitation: one back-end instance only; a restart cancels sign-ins in progress.
 */
export class InMemoryAuthorizationStateStore {
  #entries = new Map();
  constructor({
    ttlMs = 10 * 60 * 1000,
    maxEntries = 10000,
    now = () => Date.now(),
  } = {}) {
    Object.assign(this, { ttlMs, maxEntries, now });
  }

  save(state, pending) {
    if (typeof state !== 'string' || !state)
      throw new Error('Authorization state is required');
    this.#removeExpired();
    while (this.#entries.size >= this.maxEntries)
      this.#entries.delete(this.#entries.keys().next().value);
    this.#entries.set(state, {
      ...pending,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  consume(state, expectedPurpose) {
    if (typeof state !== 'string') return null;
    const pending = this.#entries.get(state);
    if (!pending) return null;
    if (pending.expiresAt <= this.now()) {
      this.#entries.delete(state);
      return null;
    }
    if (expectedPurpose && (pending.purpose ?? 'LOGIN') !== expectedPurpose)
      return null;
    this.#entries.delete(state);
    return pending;
  }

  #removeExpired() {
    const now = this.now();
    for (const [state, pending] of this.#entries)
      if (pending.expiresAt <= now) this.#entries.delete(state);
  }
}
