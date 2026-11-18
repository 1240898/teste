import '../../../src/shared/config/index.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import {
  DEFAULT_ALLERGEN_NAMES,
  describeAllergenSeedConflicts,
  seedAllergens,
} from '../../../src/modules/allergen-management/infrastructure/seedAllergens.js';
import {
  DEFAULT_CATEGORY_NAMES,
  seedProductCategories,
} from '../../../src/modules/product-category-management/infrastructure/seedProductCategories.js';
import { ProductCategoryRepository } from '../../../src/modules/product-category-management/infrastructure/persistence/ProductCategoryRepository.js';

const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

describeDB('BCK03/BCK04 reference data seed (isolated schema)', () => {
  let database;
  beforeAll(async () => {
    database = await isolatedDatabase();
    await migrate(database);
  });
  afterAll(async () => {
    await database?.close();
  });
  beforeEach(async () => {
    await database.query('DELETE FROM allergens');
    await database.query('DELETE FROM product_categories');
    await database.query(
      "SELECT setval('product_category_id_seq', 1, false)",
    );
  });

  test('loads the 14 EU allergens with ids 1..14', async () => {
    expect(await seedAllergens(database)).toEqual({
      inserted: 14,
      conflicts: [],
    });
    const { rows } = await database.query(
      'SELECT id, name FROM allergens ORDER BY id',
    );
    expect(rows.map((r) => Number(r.id))).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
    expect(rows[0].name).toBe(DEFAULT_ALLERGEN_NAMES[1]);
  });

  test('loads the default product categories with CAT- identifiers', async () => {
    expect(await seedProductCategories(database)).toBe(
      DEFAULT_CATEGORY_NAMES.length,
    );
    const { rows } = await database.query(
      'SELECT id, name FROM product_categories ORDER BY id',
    );
    expect(rows.map((r) => r.name)).toEqual([...DEFAULT_CATEGORY_NAMES]);
    rows.forEach((r) => expect(r.id).toMatch(/^CAT-\d{5,}$/));
  });

  test('is idempotent and never overwrites changes made by the Manager', async () => {
    await seedAllergens(database);
    await seedProductCategories(database);
    await database.query(`UPDATE allergens SET name = 'Glúten' WHERE id = 1`);
    await database.query('DELETE FROM allergens WHERE id = 14');
    await database.query(
      `UPDATE product_categories SET name = 'Drinks' WHERE lower(name) = 'beverages'`,
    );

    // Deleted allergen 14 comes back; renamed allergen 1 keeps the Manager's name.
    expect(await seedAllergens(database)).toEqual({
      inserted: 1,
      conflicts: [],
    });
    const { rows: gluten } = await database.query(
      'SELECT name FROM allergens WHERE id = 1',
    );
    expect(gluten[0].name).toBe('Glúten');

    // Only the renamed-away default ("Beverages") is missing, so only it is re-inserted.
    expect(await seedProductCategories(database)).toBe(1);
    expect(await seedProductCategories(database)).toBe(0);
  });

  test('reports a missing allergen whose default name is used by another allergen', async () => {
    await seedAllergens(database);
    await database.query('DELETE FROM allergens WHERE id = 7');
    await database.query(`UPDATE allergens SET name = 'MILK' WHERE id = 3`);

    const result = await seedAllergens(database);
    expect(result).toEqual({
      inserted: 0,
      conflicts: [
        {
          id: 7,
          name: 'Milk',
          conflictingAllergenId: 3,
          conflictingName: 'MILK',
        },
      ],
    });
    expect(describeAllergenSeedConflicts(result.conflicts)[0]).toMatch(
      /Allergen 7 \("Milk"\) was not restored: allergen 3/,
    );

    // Once the Manager renames allergen 3, the next run restores allergen 7.
    await database.query(`UPDATE allergens SET name = 'Eggs' WHERE id = 3`);
    expect(await seedAllergens(database)).toEqual({
      inserted: 1,
      conflicts: [],
    });
  });

  test('category identifiers keep every digit beyond 99999 (no truncation, no duplicates)', async () => {
    await database.query("SELECT setval('product_category_id_seq', 99999)");
    const repository = new ProductCategoryRepository(database);
    expect((await repository.nextId()).getValue()).toBe('CAT-100000');
    expect(await seedProductCategories(database)).toBe(
      DEFAULT_CATEGORY_NAMES.length,
    );
    const { rows } = await database.query(
      'SELECT id FROM product_categories ORDER BY id',
    );
    expect(rows.map((r) => r.id)).toEqual([
      'CAT-100001',
      'CAT-100002',
      'CAT-100003',
      'CAT-100004',
    ]);
  });
});