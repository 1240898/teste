export class PostgresActivationLock {
  async acquireMembershipLock(tx) {
    await tx.query('SELECT pg_advisory_xact_lock(7420102)');
  }
}
