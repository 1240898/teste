const USER_ID_PATTERN = /^USR-\d{5,}$/i;
export class UserDirectoryAdapter {
  constructor(database) {
    this.database = database;
  }
  async findById(userId, tx = this.database) {
    if (typeof userId !== 'string' || !USER_ID_PATTERN.test(userId.trim()))
      return null;
    const { rows } = await tx.query(
      'SELECT name, email, active, roles FROM users WHERE id = $1',
      [userId.trim().toUpperCase()],
    );
    return rows[0] ?? null;
  }
}
