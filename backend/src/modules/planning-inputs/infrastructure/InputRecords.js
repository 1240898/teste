import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { InputError } from '../domain/InputError.js';

const missing = () => new InputError('EXECUTION_NOT_FOUND', 'Input execution does not exist.', 404);
const historicalMissing = () => new InputError('HISTORICAL_INPUTS_UNAVAILABLE', 'Original inputs cannot be recovered.', 422);
const conflict = () => new InputError('EXECUTION_SELECTION_CONFLICT', 'Execution ID is already bound to a different selection.', 409);
const stale = () => new InputError('STALE_ATTEMPT', 'Input attempt has expired or is no longer current.', 409);
// Compare JSON values, independent of object prototypes (e.g. VM/test realms).
const sameJson = (a, b) => isDeepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
const summary = (row) => ({ selection: row.selection, attemptNo: row.attemptNo,
  expiresAt: row.expiresAt, snapshotId: row.snapshotId });
function replayCompatible(selection, original) {
  const business = (input) => Object.fromEntries(Object.entries(input)
    .filter(([key]) => !['executionId', 'scenarioId', 'mode', 'replayedFrom'].includes(key)));
  if (!sameJson(business(selection), business(original))) throw conflict();
}

// Demo/test adapter only. Production uses the PostgreSQL adapter below.
export class MemoryInputRecords {
  constructor({ clock = () => Date.now(), leaseMs = 120000 } = {}) {
    Object.assign(this, { clock, leaseMs }); this.rows = new Map();
  }
  async claim(selection) {
    const id = selection.executionId, before = this.rows.get(id);
    if (before && !sameJson(before.selection, selection)) throw conflict();
    if (before && (before.document || this.clock() < Date.parse(before.expiresAt))) return summary(before);
    const original = selection.mode === 'historicalReplay' ? this.rows.get(selection.replayedFrom) : null;
    if (selection.mode === 'historicalReplay' && !original?.document) throw historicalMissing();
    if (original) replayCompatible(selection, original.document.selection);
    const row = { selection: structuredClone(selection), attemptNo: (before?.attemptNo ?? 0) + 1,
      expiresAt: new Date(this.clock() + this.leaseMs).toISOString(),
      snapshotId: original ? randomUUID() : null, document: original ? structuredClone(original.document) : null };
    this.rows.set(id, row); return summary(row);
  }
  async get(id) {
    const row = this.rows.get(id); if (!row) throw missing();
    return structuredClone({ execution: summary(row), snapshot: row.document
      ? { snapshotId: row.snapshotId, schemaVersion: 1, document: row.document } : null });
  }
  async bind(id, attemptNo, document) {
    const row = this.rows.get(id); if (!row) throw missing();
    if (row.document) return this.get(id);
    if (row.attemptNo !== attemptNo || this.clock() >= Date.parse(row.expiresAt)) throw stale();
    if (!sameJson(document.selection, row.selection)) throw conflict();
    row.snapshotId = randomUUID(); row.document = structuredClone(document);
    return this.get(id);
  }
}

function fromRow(row) {
  return row && { selection: row.selection, attemptNo: row.attempt_no,
    expiresAt: new Date(row.expires_at).toISOString(), snapshotId: row.snapshot_id, document: row.document };
}

export class PostgresInputRecords {
  constructor(database, { leaseMs = 120000 } = {}) { Object.assign(this, { database, leaseMs }); }
  async claim(selection) {
    return this.database.withTransaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [selection.executionId]);
      const { rows } = await tx.query('SELECT * FROM planning_input_runs WHERE execution_id = $1 FOR UPDATE', [selection.executionId]);
      const before = fromRow(rows[0]);
      if (before && !sameJson(before.selection, selection)) throw conflict();
      if (before?.document) return summary(before);
      // A SELECT target expression may run before FOR UPDATE waits. Read the
      // clock in a separate statement after holding the lock.
      const { rows: clock } = await tx.query('SELECT clock_timestamp() AS server_now');
      if (before && new Date(clock[0].server_now) < new Date(before.expiresAt)) return summary(before);
      let original;
      if (selection.mode === 'historicalReplay') {
        const result = await tx.query('SELECT document FROM planning_input_runs WHERE execution_id = $1', [selection.replayedFrom]);
        original = result.rows[0]?.document; if (!original) throw historicalMissing();
        replayCompatible(selection, original.selection);
      }
      const result = await tx.query(`INSERT INTO planning_input_runs
        (execution_id, selection, attempt_no, expires_at, snapshot_id, document)
        VALUES ($1, $2::jsonb, 1, clock_timestamp() + $3 * interval '1 millisecond', $4, $5::jsonb)
        ON CONFLICT (execution_id) DO UPDATE SET attempt_no = planning_input_runs.attempt_no + 1,
          expires_at = clock_timestamp() + $3 * interval '1 millisecond'
        RETURNING *`, [selection.executionId, JSON.stringify(selection), this.leaseMs,
        original ? randomUUID() : null, original ? JSON.stringify(original) : null]);
      return summary(fromRow(result.rows[0]));
    });
  }
  async get(id) {
    const { rows } = await this.database.query('SELECT * FROM planning_input_runs WHERE execution_id = $1', [id]);
    const row = fromRow(rows[0]); if (!row) throw missing();
    return { execution: summary(row), snapshot: row.document
      ? { snapshotId: row.snapshotId, schemaVersion: 1, document: row.document } : null };
  }
  async bind(id, attemptNo, document) {
    await this.database.withTransaction(async (tx) => {
      const { rows } = await tx.query('SELECT * FROM planning_input_runs WHERE execution_id = $1 FOR UPDATE', [id]);
      const row = fromRow(rows[0]); if (!row) throw missing();
      if (row.document) return;
      if (row.attemptNo !== attemptNo) throw stale();
      if (!sameJson(document.selection, row.selection)) throw conflict();
      // Check expiry at the write, after the row lock has been acquired.
      const updated = await tx.query(`UPDATE planning_input_runs SET snapshot_id = $2, document = $3::jsonb
        WHERE execution_id = $1 AND attempt_no = $4 AND expires_at > clock_timestamp() RETURNING execution_id`,
      [id, randomUUID(), JSON.stringify(document), attemptNo]);
      if (updated.rows.length === 0) throw stale();
    });
    return this.get(id);
  }
}
