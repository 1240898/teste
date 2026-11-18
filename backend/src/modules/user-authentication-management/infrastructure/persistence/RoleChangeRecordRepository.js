export class RoleChangeRecordRepository {
  constructor(database) {
    this.database = database;
  }

  async save(record, tx = this.database) {
    await tx.query(
      `INSERT INTO role_change_records
       (id, user_id, changed_at, previous_roles, new_roles, actor_type, actor_user_id, system_process)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        record.id,
        record.userId,
        record.changedAt,
        record.previousRoles,
        record.newRoles,
        record.actor.type,
        record.actor.userId ?? null,
        record.actor.systemProcess ?? null,
      ],
    );
  }
}
