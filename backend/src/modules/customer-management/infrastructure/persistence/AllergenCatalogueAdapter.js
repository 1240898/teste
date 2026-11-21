/** GDP01: read-only view of the BCK04 allergen catalogue (ids 1..14). */
export class AllergenCatalogueAdapter {
  constructor(database) {
    this.database = database;
  }
  async findByIds(ids) {
    if (!ids.length) return [];
    const { rows } = await this.database.query(
      'SELECT id, name FROM allergens WHERE id = ANY($1::smallint[]) ORDER BY id',
      [ids],
    );
    return rows.map((row) => ({ id: Number(row.id), name: row.name }));
  }
}