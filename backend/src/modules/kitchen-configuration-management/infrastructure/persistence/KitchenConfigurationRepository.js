import { AppError } from '../../../../shared/errors/AppError.js';
import { KitchenConfigurationValidationError } from '../../domain/errors/KitchenConfigurationValidationError.js';
import { KitchenConfigurationId } from '../../domain/model/KitchenConfigurationId.js';
import { KitchenConfigurationRowMapper } from './KitchenConfigurationRowMapper.js';

const COLUMNS = `id, name, status, version, content, element_count,
  created_at, created_by, updated_at, updated_by, activated_at, activated_by`;
const SUMMARY_COLUMNS =
  'id, name, status, version, element_count, updated_at, activated_at';
// Transaction-level advisory lock key serialising activations (D5).
const ACTIVATION_LOCK_KEY = 7420625;

function mapWriteError(error) {
  if (error instanceof AppError) throw error;
  if (error.code === '23505' && /single_active/.test(error.constraint ?? ''))
    throw new AppError(
      'Another activation was in progress. Reload and try again.',
      409,
    );
  if (error.code === '23505')
    throw new AppError(
      'A kitchen configuration with this name already exists',
      409,
    );
  // An asset disappeared between validation and the link insert (3.5).
  if (
    error.code === '23503' &&
    /asset/.test(error.constraint ?? error.message ?? '')
  )
    throw new KitchenConfigurationValidationError([
      {
        path: '/elements',
        code: 'UNKNOWN_ASSET',
        message: 'A referenced asset no longer exists',
        params: {},
      },
    ]);
  throw error;
}

/** PostgreSQL adapter of IKitchenConfigurationRepository. Parameterised queries only. */
export class KitchenConfigurationRepository {
  constructor(database) {
    this.database = database;
  }

  #client(tx) {
    return tx ?? this.database;
  }

  async nextId(tx) {
    const { rows } = await this.#client(tx).query(
      // GREATEST keeps every digit: lpad alone truncates values above 99999.
      `SELECT 'KCF-' || lpad(n::text, GREATEST(5, length(n::text)), '0') AS id
       FROM (SELECT nextval('kitchen_configuration_id_seq') AS n) generated`,
    );
    return KitchenConfigurationId.create(rows[0].id);
  }

  async findAllSummaries() {
    const { rows } = await this.database.query(
      `SELECT ${SUMMARY_COLUMNS} FROM kitchen_configurations ORDER BY lower(name), id`,
    );
    return rows.map((row) => KitchenConfigurationRowMapper.toSummary(row));
  }

  async findById(id, tx) {
    const { rows } = await this.#client(tx).query(
      `SELECT ${COLUMNS} FROM kitchen_configurations WHERE id = $1`,
      [id.getValue()],
    );
    return rows[0] ? KitchenConfigurationRowMapper.toDomain(rows[0]) : null;
  }

  async findByIdForUpdate(id, tx) {
    if (!tx) throw new TypeError('findByIdForUpdate requires a transaction');
    const { rows } = await tx.query(
      `SELECT ${COLUMNS} FROM kitchen_configurations WHERE id = $1 FOR UPDATE`,
      [id.getValue()],
    );
    return rows[0] ? KitchenConfigurationRowMapper.toDomain(rows[0]) : null;
  }

  async findActive(tx) {
    const { rows } = await this.#client(tx).query(
      `SELECT ${COLUMNS} FROM kitchen_configurations WHERE status = 'ACTIVE'`,
    );
    return rows[0] ? KitchenConfigurationRowMapper.toDomain(rows[0]) : null;
  }

  async existsByName(name, excludeId, tx) {
    const { rows } = await this.#client(tx).query(
      `SELECT EXISTS (SELECT 1 FROM kitchen_configurations
         WHERE lower(name) = $1 AND ($2::varchar IS NULL OR id <> $2)) AS taken`,
      [name.getKey(), excludeId?.getValue() ?? null],
    );
    return rows[0].taken === true;
  }

  async insert(configuration, tx) {
    try {
      await tx.query(
        `INSERT INTO kitchen_configurations
           (id, name, status, version, content, element_count,
            created_at, created_by, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $7, $8)`,
        KitchenConfigurationRowMapper.toParams(configuration),
      );
      await this.#writeAssetLinks(configuration, tx, false);
    } catch (error) {
      mapWriteError(error);
    }
  }

  /** Conditional UPDATE (never touches status) + rewrite of the asset links. */
  async replace(configuration, expectedVersion, tx) {
    const audit = configuration.getAudit();
    const layout = configuration.getLayout();
    try {
      const result = await tx.query(
        `UPDATE kitchen_configurations
            SET name = $3, content = $4::jsonb, element_count = $5,
                updated_at = $6, updated_by = $7, version = version + 1
          WHERE id = $1 AND version = $2`,
        [
          configuration.getId().getValue(),
          expectedVersion,
          configuration.getName().getValue(),
          JSON.stringify(layout.toJSON()),
          layout.elementCount,
          audit.updatedAt,
          audit.updatedBy,
        ],
      );
      if (result.rowCount === 0) return false;
      await this.#writeAssetLinks(configuration, tx, true);
      return true;
    } catch (error) {
      return mapWriteError(error);
    }
  }

  async lockActivation(tx) {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [ACTIVATION_LOCK_KEY]);
  }

  async deactivateCurrent(exceptId, tx) {
    const { rows } = await tx.query(
      `UPDATE kitchen_configurations SET status = 'INACTIVE'
        WHERE status = 'ACTIVE' AND id <> $1
        RETURNING id`,
      [exceptId.getValue()],
    );
    return rows[0] ? KitchenConfigurationId.create(rows[0].id) : null;
  }

  async markActive(configuration, tx) {
    const audit = configuration.getAudit();
    try {
      const result = await tx.query(
        `UPDATE kitchen_configurations
            SET status = 'ACTIVE', activated_at = $2, activated_by = $3
          WHERE id = $1`,
        [
          configuration.getId().getValue(),
          audit.activatedAt,
          audit.activatedBy,
        ],
      );
      return result.rowCount === 1;
    } catch (error) {
      return mapWriteError(error);
    }
  }

  async deleteIfInactive(id) {
    const result = await this.database.query(
      `DELETE FROM kitchen_configurations WHERE id = $1 AND status = 'INACTIVE'`,
      [id.getValue()],
    );
    return result.rowCount === 1;
  }

  async #writeAssetLinks(configuration, tx, replace) {
    const id = configuration.getId().getValue();
    if (replace)
      await tx.query(
        'DELETE FROM kitchen_configuration_assets WHERE configuration_id = $1',
        [id],
      );
    const assetIds = configuration.getLayout().referencedAssetIds();
    if (assetIds.length)
      await tx.query(
        `INSERT INTO kitchen_configuration_assets (configuration_id, asset_id)
         SELECT $1, unnest($2::varchar[])`,
        [id, assetIds],
      );
  }
}