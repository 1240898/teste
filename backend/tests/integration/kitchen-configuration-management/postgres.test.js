import '../../../src/shared/config/index.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { createKitchenConfigurationModule } from '../../../src/modules/kitchen-configuration-management/index.js';
import {
  CATALOGUE,
  MemoryKitchenAssetFileStore,
  sample,
} from '../../helpers/kitchenConfigurationFixtures.js';


/**
 * Asset ids a layout references, read from the JSON itself (not from the code
 * under test): every model.assetId and every material "...MapAssetId".
 */
function expectedAssetIds(layout) {
  const ids = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return undefined;
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'assetId' || key.endsWith('MapAssetId')) && child)
        ids.add(child);
      else visit(child);
    }
    return undefined;
  };
  visit(layout);
  return [...ids].sort();
}

const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const authMiddleware = { verifyToken: (_req, _res, next) => next() };

describeDB(
  'WEB06 PostgreSQL (isolated schema in dedicated _test database)',
  () => {
    let database, service;

    beforeAll(async () => {
      database = await isolatedDatabase();
      await migrate(database);
      for (const asset of CATALOGUE)
        await database.query(
          `INSERT INTO kitchen_assets (id, kind, format, path, description, size_x, size_y, size_z, embedded_texture_set)
         VALUES ($1, $2, $3, $4, '', $5, $6, $7, $8)`,
          [
            asset.id,
            asset.kind,
            asset.format,
            asset.path,
            asset.size?.x ?? null,
            asset.size?.y ?? null,
            asset.size?.z ?? null,
            asset.embeddedTextureSet,
          ],
        );
      service = createKitchenConfigurationModule({
        database,
        authMiddleware,
        assetFiles: new MemoryKitchenAssetFileStore(),
        assetsPublicUrl: 'http://localhost:8080/api/v1/kitchen-assets/files',
      }).configurationService;
    });

    afterAll(async () => {
      await database?.close();
    });

    const create = (name, content = sample('compact')) =>
      service.createConfiguration({ name, content }, null);
    const activeIds = async () =>
      (
        await database.query(
          `SELECT id FROM kitchen_configurations WHERE status = 'ACTIVE'`,
        )
      ).rows.map((row) => row.id);

    test('creates with a KCF- id, stores asset links and reads it back', async () => {
      const created = await create('Compact kitchen');
      expect(created.id).toMatch(/^KCF-\d{5}$/);
      expect((await service.getConfiguration(created.id)).content).toEqual(
        sample('compact'),
      );
            // Every reference of the sample is linked, and nothing else.
      const { rows } = await database.query(
        'SELECT asset_id FROM kitchen_configuration_assets WHERE configuration_id = $1',
        [created.id],
      );
      // Sorted in JS: the database collation may order '-' differently.
      expect(rows.map((row) => row.asset_id).sort()).toEqual(
        expectedAssetIds(sample('compact')),
      );
      await expect(create('compact KITCHEN')).rejects.toMatchObject({
        status: 409,
      });
    });

    test('IT07 - a second ACTIVE row is impossible (partial unique index)', async () => {
      const a = await create('Index A');
      const b = await create('Index B');
      await database.query(
        `UPDATE kitchen_configurations SET status = 'INACTIVE'`,
      );
      await database.query(
        `UPDATE kitchen_configurations SET status = 'ACTIVE' WHERE id = $1`,
        [a.id],
      );
      await expect(
        database.query(
          `UPDATE kitchen_configurations SET status = 'ACTIVE' WHERE id = $1`,
          [b.id],
        ),
      ).rejects.toMatchObject({ code: '23505' });
    });

    test('IT08 - 10 concurrent activations end with exactly one ACTIVE', async () => {
      const created = [];
      for (let index = 0; index < 10; index += 1)
        created.push(await create(`Concurrent ${index}`));
      const results = await Promise.allSettled(
        created.map(({ id }) => service.activateConfiguration(id, null)),
      );
      expect(results.every((result) => result.status === 'fulfilled')).toBe(
        true,
      );
      expect(await activeIds()).toHaveLength(1);
    });

    test('IT09 - a failure after deactivating the previous one rolls back', async () => {
      const previous = (await activeIds())[0];
      const target = await create('Rollback target');
      await expect(
        database.withTransaction(async (tx) => {
          await tx.query(
            `UPDATE kitchen_configurations SET status = 'INACTIVE' WHERE status = 'ACTIVE'`,
          );
          throw new Error('simulated failure');
        }),
      ).rejects.toThrow('simulated failure');
      expect(await activeIds()).toEqual([previous]);
      expect((await service.getConfiguration(target.id)).status).toBe(
        'INACTIVE',
      );
    });

        // ON DELETE RESTRICT: PostgreSQL 18 reports restrict_violation (23001);
    // earlier versions report foreign_key_violation (23503). Both block it.
    const RESTRICTED = ['23001', '23503'];

    test('IT10a - a referenced asset cannot be deleted', async () => {
      await create('Restricted asset');
      const error = await database
        .query(`DELETE FROM kitchen_assets WHERE id = 'AST-MDL-OVEN-LINE-01'`)
        .catch((caught) => caught);
      expect(error).toBeInstanceOf(Error);
      expect(RESTRICTED).toContain(error.code);
      const { rows } = await database.query(
        `SELECT count(*)::int AS n FROM kitchen_assets WHERE id = 'AST-MDL-OVEN-LINE-01'`,
      );
      expect(rows[0].n).toBe(1);
    });

    test('IT10b - an edit with a stale version changes nothing', async () => {
      const configuration = await create('Stale edit');
      await service.updateConfiguration(
        configuration.id,
        { name: 'Stale edit', content: sample('extended'), version: 1 },
        null,
      );
      const { rowCount } = await database.query(
        `UPDATE kitchen_configurations SET name = 'X1' WHERE id = $1 AND version = 1`,
        [configuration.id],
      );
      expect(rowCount).toBe(0);
      await expect(
        service.updateConfiguration(
          configuration.id,
          { name: 'Stale edit', content: sample('compact'), version: 1 },
          null,
        ),
      ).rejects.toMatchObject({ status: 409 });
      const stored = await service.getConfiguration(configuration.id);
      expect(stored).toMatchObject({ name: 'Stale edit', version: 2 });
      expect(stored.content).toEqual(sample('extended'));
    });

    test('IT10c - the active configuration is not deleted', async () => {
      const configuration = await create('Active not deleted');
      await service.activateConfiguration(configuration.id, null);
      const deleted = await database.query(
        `DELETE FROM kitchen_configurations WHERE id = $1 AND status = 'INACTIVE'`,
        [configuration.id],
      );
      expect(deleted.rowCount).toBe(0);
      await expect(
        service.deleteConfiguration(configuration.id),
      ).rejects.toMatchObject({ status: 409 });
      expect(await activeIds()).toEqual([configuration.id]);
    });

    test('migration is idempotent', async () => {
      expect(await migrate(database)).toBe(0);
    });
  },
);
