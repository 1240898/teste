import { KitchenAsset } from '../../domain/model/KitchenAsset.js';

const COLUMNS = `id, kind, format, path, description, size_x, size_y, size_z,
  embedded_texture_set`;

const toAsset = (row) =>
  new KitchenAsset({
    id: row.id,
    kind: row.kind,
    format: row.format,
    path: row.path,
    description: row.description,
    size:
      row.size_x === null || row.size_x === undefined
        ? null
        : {
            x: Number(row.size_x),
            y: Number(row.size_y),
            z: Number(row.size_z),
          },
    embeddedTextureSet: row.embedded_texture_set,
  });

/** PostgreSQL adapter of IKitchenAssetCatalogue (read-only in Sprint 2). */
export class KitchenAssetCatalogue {
  constructor(database) {
    this.database = database;
  }

  async findByIds(ids, tx) {
    const result = new Map();
    if (!ids.length) return result;
    const { rows } = await (tx ?? this.database).query(
      `SELECT ${COLUMNS} FROM kitchen_assets WHERE id = ANY($1::varchar[])`,
      [ids],
    );
    for (const row of rows) result.set(row.id, toAsset(row));
    return result;
  }

  async findAll() {
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS} FROM kitchen_assets ORDER BY kind, id`,
    );
    return rows.map(toAsset);
  }
}