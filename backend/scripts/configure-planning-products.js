import { readFile } from 'node:fs/promises';
import '../src/shared/config/index.js';
import { createDatabase } from '../src/shared/persistence/postgres/index.js';
import { requireValue, safeInteger } from '../src/modules/planning-inputs/domain/InputError.js';

// Explicit Backoffice configuration, never invoked by a calculation or by Prolog.
// File format: [{"productId":"PROD-00123","stockUnit":"g","stockUnitsPerSale":120}].
if (!process.argv[2]) throw new Error('Pass the product planning configuration JSON file.');
const settings = JSON.parse(await readFile(process.argv[2], 'utf8'));
requireValue(Array.isArray(settings), 'INVALID_INPUT', 'settings', null, 'Expected an array.');
requireValue(new Set(settings.map((row) => row.productId)).size === settings.length,
  'DUPLICATE_REFERENCE', 'productId', null, 'Each product must occur once.');
for (const row of settings) {
  requireValue(typeof row.productId === 'string' && typeof row.stockUnit === 'string' && row.stockUnit.trim().length > 0,
    'INVALID_INPUT', 'settings', null, 'Explicit product and stock unit are required.');
  if (row.stockUnitsPerSale != null) safeInteger(row.stockUnitsPerSale, 'stockUnitsPerSale', row.productId);
}
const database = createDatabase();
try {
  await database.withTransaction(async (tx) => {
    for (const row of settings) await tx.query(`INSERT INTO planning_product_settings (product_id, stock_unit, stock_units_per_sale)
      VALUES ($1, $2, $3) ON CONFLICT (product_id) DO UPDATE
      SET stock_unit = EXCLUDED.stock_unit, stock_units_per_sale = EXCLUDED.stock_units_per_sale`,
    [row.productId, row.stockUnit, row.stockUnitsPerSale ?? null]);
  });
  console.log(`Configured ${settings.length} product planning records; stock was not changed.`);
} finally { await database.close(); }
