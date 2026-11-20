import { FileSecurityAuditOutbox } from './FileSecurityAuditOutbox.js';

// Only errors caused by this event's values/constraints justify isolation.
// Connection, transaction, schema, and other infrastructure failures stay queued.
const isRecordSpecificPersistenceError = (error) =>
  typeof error?.code === 'string' && /^(22|23)/.test(error.code);

/** Stores each denial durably, then delivers it in bounded, isolated batches. */
export class SecurityAuditLogger {
  #retryTimer = null;
  #writes = new Set();
  #draining = null;
  #ready;
  #stopped = false;

  constructor({
    repository,
    logger = console,
    retryDelayMs = 1000,
    batchSize = 50,
    outbox = new FileSecurityAuditOutbox(),
  } = {}) {
    this.repository = repository;
    this.logger = logger;
    this.retryDelayMs = retryDelayMs;
    this.batchSize = batchSize;
    this.outbox = outbox;
    this.#ready = Promise.resolve().then(() => this.outbox.initialize());
    void this.#ready.then(() => this.#scheduleDrain(0)).catch(() => {});
  }

  record(event) {
    const write = this.#ready.then(() => this.outbox.store(event));
    this.#writes.add(write);
    void write.then(
      () => {
        this.#writes.delete(write);
        this.#scheduleDrain(0);
      },
      () => this.#writes.delete(write),
    );
    return write;
  }

  /** Deliver pending events now; a transient failure remains queued for retry. */
  async flush() {
    await this.#ready;
    while (this.#writes.size) await Promise.allSettled([...this.#writes]);
    while (this.repository) {
      if (this.#retryTimer) {
        clearTimeout(this.#retryTimer);
        this.#retryTimer = null;
      }
      const retry = this.#draining ? await this.#draining : await this.#drain();
      if (retry) return;
      const [pending] = await this.outbox.listPending({ limit: 1 });
      if (!pending) return;
    }
  }

  /** Stops retry timers before dependent resources (such as PostgreSQL) close. */
  async stop() {
    this.#stopped = true;
    if (this.#retryTimer) {
      clearTimeout(this.#retryTimer);
      this.#retryTimer = null;
    }
    await this.#ready;
    while (this.#writes.size) await Promise.allSettled([...this.#writes]);
    if (this.#draining) await this.#draining;
  }

  #scheduleDrain(delayMs) {
    if (!this.repository || this.#retryTimer || this.#stopped) return;
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      void this.#drain().catch(() => {});
    }, delayMs);
    this.#retryTimer.unref?.();
  }

  #drain() {
    if (!this.repository || this.#stopped) return Promise.resolve();
    if (this.#draining) return this.#draining;

    const draining = this.#runDrain().then(async (retry) => {
      if (retry) {
        this.#scheduleDrain(this.retryDelayMs);
        return true;
      }
      try {
        if ((await this.outbox.listPending({ limit: 1 })).length)
          this.#scheduleDrain(0);
      } catch {
        this.logger.error(
          'Security audit outbox could not be read; recovery is required',
        );
        this.#scheduleDrain(this.retryDelayMs);
      }
      return false;
    });
    this.#draining = draining.finally(() => {
      this.#draining = null;
    });
    return this.#draining;
  }

  async #runDrain() {
    if (!this.repository) return false;
    let events;
    try {
      events = await this.outbox.listPending({ limit: this.batchSize });
    } catch {
      this.logger.error(
        'Security audit outbox could not be read; recovery is required',
      );
      return true;
    }

    let retry = false;
    for (const event of events) {
      try {
        await this.repository.save(event);
        await this.outbox.acknowledge(event.requestId);
      } catch (error) {
        try {
                    await this.outbox.incrementFailureCount(event.requestId);
          if (
            isRecordSpecificPersistenceError(error)
          ) {
            await this.outbox.quarantine(event.requestId);
            this.logger.error(
              'Security audit event isolated in dead-letter outbox',
              { requestId: event.requestId },
            );
          } else {
            retry = true;
            this.logger.error(
              'Security audit persistence failed; event retained in durable outbox',
              { requestId: event.requestId },
            );
          }
        } catch {
          retry = true;
          this.logger.error(
            'Security audit event could not be isolated or recorded for retry',
            { requestId: event.requestId },
          );
        }
      }
    }
    return retry;
  }
}
