import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DEFAULT_DIRECTORY = resolve(
  process.cwd(),
  '.runtime/security-audit-outbox',
);

/** Private, fsync-backed storage for audit events awaiting PostgreSQL delivery. */
export class FileSecurityAuditOutbox {
  constructor(
    directory = process.env.SECURITY_AUDIT_SPOOL_DIR || DEFAULT_DIRECTORY,
  ) {
    this.directory = resolve(directory);
    this.deadLetterDirectory = join(this.directory, 'dead-letter');
  }

  async initialize() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await mkdir(this.deadLetterDirectory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
    await chmod(this.deadLetterDirectory, 0o700);
    await this.#syncDirectory(this.directory);
  }

  async store(event) {
    await this.initialize();
    const filePath = this.#eventPath(event.requestId);
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    let file;
    try {
      file = await open(temporaryPath, 'wx', 0o600);
      await file.writeFile(JSON.stringify(event), 'utf8');
      await file.sync();
      await file.close();
      file = undefined;
      await rename(temporaryPath, filePath);
      await this.#syncDirectory(this.directory);
    } catch (error) {
      await file?.close().catch(() => {});
      await unlink(temporaryPath).catch(() => {});
      throw error;
    }
  }

  /** Reads one bounded batch; malformed records are retained in dead-letter. */
  async listPending({ limit = 50 } = {}) {
    await this.initialize();
    const names = (await readdir(this.directory))
      .filter((name) => /^[a-f0-9]{64}\.json$/i.test(name))
      .sort();
    const events = [];
    for (const name of names) {
      if (events.length >= Math.max(1, limit)) break;
      try {
        const event = JSON.parse(
          await readFile(join(this.directory, name), 'utf8'),
        );
        if (
          typeof event?.requestId !== 'string' ||
          this.#eventFileName(event.requestId) !== name
        )
          throw new Error('Invalid security audit outbox record');
        events.push(event);
      } catch {
        await this.#quarantineFile(name, 'UNREADABLE_RECORD');
      }
    }
    return events.sort((a, b) =>
      String(a.timestamp).localeCompare(String(b.timestamp)),
    );
  }

  async incrementFailureCount(requestId) {
    await this.initialize();
    const filePath = `${this.#eventPath(requestId)}.attempts`;
    let attempts = 0;
    try {
      attempts = Number(await readFile(filePath, 'utf8')) || 0;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    attempts += 1;
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    const file = await open(temporaryPath, 'wx', 0o600);
    try {
      await file.writeFile(String(attempts), 'utf8');
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporaryPath, filePath);
    await this.#syncDirectory(this.directory);
    return attempts;
  }

  async quarantine(requestId, reason = 'DELIVERY_REJECTED') {
    await this.initialize();
    return this.#quarantineFile(`${this.#eventFileName(requestId)}`, reason);
  }

  async acknowledge(requestId) {
    await this.initialize();
    const eventPath = this.#eventPath(requestId);
    await unlink(eventPath);
    await unlink(`${eventPath}.attempts`).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await this.#syncDirectory(this.directory);
  }

  #eventPath(requestId) {
    return join(this.directory, this.#eventFileName(requestId));
  }

  #eventFileName(requestId) {
    const key = createHash('sha256').update(String(requestId)).digest('hex');
    return `${key}.json`;
  }

  async #quarantineFile(fileName, reason) {
    const source = join(this.directory, fileName);
    const suffix = randomUUID();
    const targetName = `${Date.now()}-${suffix}-${fileName}`;
    const target = join(this.deadLetterDirectory, targetName);
    await rename(source, target);
    const attemptsPath = `${source}.attempts`;
    const metadata = {
      reason,
      quarantinedAt: new Date().toISOString(),
      originalFile: fileName,
    };
    try {
      metadata.deliveryAttempts =
        Number(await readFile(attemptsPath, 'utf8')) || 0;
      await rename(attemptsPath, `${target}.attempts`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const metadataPath = `${target}.metadata`;
    const file = await open(metadataPath, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(metadata), 'utf8');
      await file.sync();
    } finally {
      await file.close();
    }
    await this.#syncDirectory(this.deadLetterDirectory);
    await this.#syncDirectory(this.directory);
    return target;
  }

    async #syncDirectory(path) {
    // NTFS already journals directory entries, so skipping is safe there.
    if (process.platform === 'win32') return;

    const directory = await open(path, 'r');
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
}
