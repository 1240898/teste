export class PostgresUnitOfWork {
  constructor(database) {
    this.database = database;
  }

  withTransaction(work) {
    return this.database.withTransaction(work);
  }
}
