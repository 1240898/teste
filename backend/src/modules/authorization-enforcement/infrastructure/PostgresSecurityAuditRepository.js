export class PostgresSecurityAuditRepository {
  constructor(database) {
    if (typeof database?.query !== 'function')
      throw new TypeError('A database is required for security audit logs');
    this.database = database;
  }

  async save(event) {
    await this.database.query(
      `INSERT INTO security_audit_logs
        (request_id, occurred_at, outcome, method, route_template, status_code, actor_id, actor_roles)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (request_id) DO NOTHING`,
      [
        event.requestId,
        event.timestamp,
        event.outcome,
        event.method,
        event.routeTemplate,
        event.statusCode,
        event.actorId,
        event.actorRoles,
      ],
    );
  }

  async search({ limit, offset, outcome, actorId, from, to }) {
    const filters = [];
    const values = [];
    const add = (sql, value) => {
      values.push(value);
      filters.push(sql.replace('?', `$${values.length}`));
    };
    if (outcome) add('outcome = ?', outcome);
    if (actorId) add('actor_id = ?', actorId);
    if (from) add('occurred_at >= ?', from);
    if (to) add('occurred_at <= ?', to);
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const count = await this.database.query(
      `SELECT count(*)::integer AS total FROM security_audit_logs ${where}`,
      values,
    );
    const rows = await this.database.query(
      `SELECT request_id, occurred_at, outcome, method, route_template,
              status_code, actor_id, actor_roles
         FROM security_audit_logs ${where}
        ORDER BY occurred_at DESC, id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    return {
      items: rows.rows.map((row) => ({
        requestId: row.request_id,
        timestamp: row.occurred_at,
        outcome: row.outcome,
        method: row.method,
        routeTemplate: row.route_template,
        statusCode: row.status_code,
        actorId: row.actor_id,
        actorRoles: row.actor_roles,
      })),
      total: count.rows[0].total,
      limit,
      offset,
    };
  }
}
