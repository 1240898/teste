import { AllergenId } from '../domain/model/AllergenId.js';
import { AllergenName } from '../domain/model/AllergenName.js';
import { EUAllergenType } from '../domain/model/EUAllergenType.js';

/**
 * Default display names for the 14 allergens of EU Regulation No. 1169/2011 (Annex II).
 * The Manager can rename them afterwards through PUT /api/v1/allergens/{id}.
 */
export const DEFAULT_ALLERGEN_NAMES = Object.freeze({
  1: 'Gluten',
  2: 'Crustaceans',
  3: 'Eggs',
  4: 'Fish',
  5: 'Peanuts',
  6: 'Soybeans',
  7: 'Milk',
  8: 'Nuts',
  9: 'Celery',
  10: 'Mustard',
  11: 'Sesame seeds',
  12: 'Sulphur dioxide and sulphites',
  13: 'Lupin',
  14: 'Molluscs',
});

/**
 * @typedef {Object} AllergenSeedConflict
 * @property {number} id EU id that could not be restored.
 * @property {string} name Default name the seed tried to use.
 * @property {number} conflictingAllergenId Allergen that already uses that name.
 * @property {string} conflictingName Its current name.
 */

/**
 * Loads the initial allergen catalogue (BCK04). Idempotent: existing allergens are left
 * untouched, so renames made by the Manager are never overwritten, and a deleted EU
 * allergen is restored on the next run.
 *
 * A missing allergen cannot be restored when another allergen already uses its default
 * name (names are unique). Such cases are not silently skipped: they are returned in
 * `conflicts` so the caller can report them; the Manager resolves them by renaming.
 * @returns {Promise<{inserted: number, conflicts: AllergenSeedConflict[]}>}
 */
export async function seedAllergens(database) {
  // Values go through the domain value objects so the seed obeys the same rules as the API.
  const allergens = Object.keys(EUAllergenType).map((key) => ({
    id: AllergenId.create(Number(key)).getValue(),
    name: AllergenName.create(DEFAULT_ALLERGEN_NAMES[key]).getValue(),
  }));
  const values = [allergens.map((a) => a.id), allergens.map((a) => a.name)];
  const result = await database.query(
    `INSERT INTO allergens (id, name)
     SELECT id, name FROM unnest($1::smallint[], $2::text[]) AS seed(id, name)
     ON CONFLICT DO NOTHING`,
    values,
  );
  // Ids still missing after the insert were blocked by the unique name index.
  const { rows } = await database.query(
    `SELECT seed.id, seed.name, a.id AS conflicting_id, a.name AS conflicting_name
     FROM unnest($1::smallint[], $2::text[]) AS seed(id, name)
     JOIN allergens a ON lower(a.name) = lower(seed.name)
     WHERE NOT EXISTS (SELECT 1 FROM allergens x WHERE x.id = seed.id)
     ORDER BY seed.id`,
    values,
  );
  return {
    inserted: result.rowCount,
    conflicts: rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      conflictingAllergenId: Number(row.conflicting_id),
      conflictingName: row.conflicting_name,
    })),
  };
}

/** lines describing seed conflicts, for scripts and logs. */
export function describeAllergenSeedConflicts(conflicts) {
  return conflicts.map(
    (c) =>
      `Allergen ${c.id} ("${c.name}") was not restored: allergen ${c.conflictingAllergenId} is already named "${c.conflictingName}". Rename allergen ${c.conflictingAllergenId} and run the seed again.`,
  );
}