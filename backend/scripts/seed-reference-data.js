import '../src/shared/config/index.js';
import { createDatabase } from '../src/shared/persistence/postgres/index.js';
import {
  describeAllergenSeedConflicts,
  seedAllergens,
} from '../src/modules/allergen-management/infrastructure/seedAllergens.js';
import { seedProductCategories } from '../src/modules/product-category-management/infrastructure/seedProductCategories.js';
  import {
  readKitchenAssetManifest,
  seedKitchenAssets,
} from '../src/modules/kitchen-configuration-management/infrastructure/seedKitchenAssets.js';

let database;
try {
  database = createDatabase();
  await database.verify();
  // WEB06: read the manifest first; a missing asset file aborts the whole seed.
  const kitchenAssetEntries = await readKitchenAssetManifest();
  const { allergens, categories, kitchenAssets } =
    await database.withTransaction(async (client) => {
      const transaction = {
        query: (text, values) => client.query(text, values),
      };
      return {
        allergens: await seedAllergens(transaction),
        categories: await seedProductCategories(transaction),
        kitchenAssets: await seedKitchenAssets(
          transaction,
          kitchenAssetEntries,
        ),
      };
    });
  console.log(
    `Reference data loaded: ${allergens.inserted} allergen(s) and ${categories} product categor${categories === 1 ? 'y' : 'ies'} inserted; kitchen assets: ${kitchenAssets.inserted} inserted, ${kitchenAssets.updated} updated.`,
  );
  if (allergens.conflicts.length) {
    describeAllergenSeedConflicts(allergens.conflicts).forEach((line) =>
      console.warn(`WARNING: ${line}`),
    );
    // Non-zero exit so CI and scripts notice the incomplete allergen catalogue.
    process.exitCode = 2;
  }
} catch {
  console.error(
    'Seeding failed and was rolled back. Check database access, that migrations were applied (npm run db:migrate) and that every kitchen asset file exists (npm run kitchen:demo-assets).',
  );
  process.exitCode = 1;
} finally {
  await database?.close();
}