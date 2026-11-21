import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SecurityAuditLogger } from '../../../src/modules/authorization-enforcement/infrastructure/SecurityAuditLogger.js';
import { FileSecurityAuditOutbox } from '../../../src/modules/authorization-enforcement/infrastructure/FileSecurityAuditOutbox.js';

describe('SecurityAuditLogger', () => {
    test('keeps a failed event queued and persists it after a retry', async () => {
    const outboxDirectory = await mkdtemp(join(tmpdir(), 'aa05-audit-logger-'));
    const event = { requestId: 'request-1', outcome: 'FORBIDDEN' };
    const save = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary database failure'))
      .mockResolvedValueOnce(undefined);
    const outbox = new FileSecurityAuditOutbox(outboxDirectory);
    const logger = new SecurityAuditLogger({
      repository: { save },
      logger: { error: jest.fn() },
      retryDelayMs: 5,
      outbox,
    });

    try {
      await logger.record(event);

      // First delivery fails: the event must stay in the outbox.
      await logger.flush();
      expect(save).toHaveBeenCalledTimes(1);
      expect(await outbox.listPending()).toEqual([event]);

      // Retry succeeds: the event is persisted and removed from the outbox.
      await logger.flush();
      expect(save).toHaveBeenCalledTimes(2);
      expect(save).toHaveBeenLastCalledWith(event);
      expect(await outbox.listPending()).toEqual([]);
    } finally {
      await logger.stop();
      await rm(outboxDirectory, { recursive: true, force: true });
    }
  });

  test('drains bounded batches and quarantines permanent failures without blocking later events', async () => {
    const outboxDirectory = await mkdtemp(join(tmpdir(), 'aa05-audit-batch-'));
    const outbox = new FileSecurityAuditOutbox(outboxDirectory);
    const events = [1, 2, 3, 4, 5].map((n) => ({
      requestId: `request-${n}`,
      timestamp: new Date(n * 1000).toISOString(),
      outcome: 'FORBIDDEN',
    }));
    const listPending = jest.spyOn(outbox, 'listPending');
    const save = jest.fn(async (event) => {
      if (event.requestId === 'request-1') {
        const error = new Error('invalid event');
        error.code = '23514';
        throw error;
      }
    });
    const logger = new SecurityAuditLogger({
      repository: { save },
      logger: { error: jest.fn() },
      batchSize: 2,
      outbox,
    });

    try {
      for (const event of events) await logger.record(event);
      await logger.flush();

      expect(save.mock.calls.map(([event]) => event.requestId).sort()).toEqual([
        'request-1',
        'request-2',
        'request-3',
        'request-4',
        'request-5',
      ]);
      expect(listPending).toHaveBeenCalledWith({ limit: 2 });
      expect(await outbox.listPending()).toEqual([]);
      const deadLetters = await readdir(outbox.deadLetterDirectory);
      const eventFile = deadLetters.find((name) => name.endsWith('.json'));
      expect(eventFile).toBeDefined();
      expect(
        JSON.parse(
          await readFile(join(outbox.deadLetterDirectory, eventFile), 'utf8'),
        ),
      ).toMatchObject({ requestId: 'request-1' });
      expect(
        JSON.parse(
          await readFile(
            join(outbox.deadLetterDirectory, `${eventFile}.metadata`),
            'utf8',
          ),
        ),
      ).toMatchObject({ reason: 'DELIVERY_REJECTED', deliveryAttempts: 1 });
    } finally {
      await logger.stop();
      await rm(outboxDirectory, { recursive: true, force: true });
    }
  });

  test('moves an unreadable pending record to dead-letter and continues delivery', async () => {
    const outboxDirectory = await mkdtemp(
      join(tmpdir(), 'aa05-audit-corrupt-'),
    );
    const outbox = new FileSecurityAuditOutbox(outboxDirectory);
    const corruptEvent = { requestId: 'corrupt-record' };
    const fileName = `${createHash('sha256').update(corruptEvent.requestId).digest('hex')}.json`;
    const save = jest.fn();
    let logger;

    try {
      await outbox.store(corruptEvent);
      await writeFile(join(outboxDirectory, fileName), '{ invalid json');
      await outbox.store({
        requestId: 'valid-record',
        timestamp: '2026-01-01',
      });
      logger = new SecurityAuditLogger({
        repository: { save },
        outbox,
      });
      await logger.flush();

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith({
        requestId: 'valid-record',
        timestamp: '2026-01-01',
      });
      expect(await outbox.listPending()).toEqual([]);
      expect(
        (await readdir(outbox.deadLetterDirectory)).some((name) =>
          name.endsWith('.metadata'),
        ),
      ).toBe(true);
    } finally {
      await logger?.stop();
      await rm(outboxDirectory, { recursive: true, force: true });
    }
  });
});
