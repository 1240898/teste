import { isDeepStrictEqual } from 'node:util';
import Joi from 'joi';
import { InputError } from '../domain/InputError.js';
import { validate } from '../api/schemas.js';

import { supplierDocumentSchema } from '../api/supplierDocumentSchema.js';

const id = Joi.string().trim().max(160);

// WEB07 sends its explicitly confirmed selection through the private records
// adapter. This store is the authoritative, immutable source for those versions.
export class ConfirmedSupplierScenarios {
  constructor(database) { this.database = database; }

  async confirm(selector, body, checkNewVersion) {
    const { id: scenarioId, version } = validate(Joi.object({ id: id.required(), version: id.required() }), selector);
    const { suppliers, products } = validate(supplierDocumentSchema.required(), body);
    const document = { suppliers, products };
    return this.database.withTransaction(async (tx) => {
      const readVersion = () => tx.query(`SELECT document FROM planning_confirmed_supplier_scenarios
        WHERE scenario_id = $1 AND version = $2`, [scenarioId, version]);
      const acknowledged = (stored) => {
        if (!isDeepStrictEqual(JSON.parse(JSON.stringify(stored)), JSON.parse(JSON.stringify(document))))
          throw new InputError('SUPPLIER_VERSION_CONFLICT', 'The confirmed version is immutable.', 409, 'version', version);
        return { id: scenarioId, version, status: 'CONFIRMED' };
      };
      const existing = (await readVersion()).rows[0];
      if (existing) return acknowledged(existing.document);

      if (checkNewVersion) await checkNewVersion(tx);
      const { rows } = await tx.query(`SELECT p.id, p.is_active, settings.stock_unit FROM products p
        LEFT JOIN planning_product_settings settings ON settings.product_id = p.id
        WHERE p.id = ANY($1::text[])`, [products.map((p) => p.productId)]);
      const byProduct = new Map(rows.map((row) => [row.id, row]));
      const supplierIds = new Set(suppliers.map((supplier) => supplier.id));
      for (const product of products) {
        const row = byProduct.get(product.productId);
        if (!row?.is_active)
          throw new InputError('UNKNOWN_PRODUCT', 'Supplier product is unknown or inactive.', 422, 'products', product.productId);
        if (!row.stock_unit || row.stock_unit !== product.stockUnit)
          throw new InputError('INCOMPATIBLE_UNITS', 'Supplier product must use its configured stock unit.', 422, 'stockUnit', product.productId);
        if (product.offers.some((quote) => !supplierIds.has(quote.supplierId)))
          throw new InputError('UNKNOWN_SUPPLIER', 'Every offer must reference a listed supplier.', 422, 'supplierId', product.productId);
      }
      const inserted = await tx.query(`INSERT INTO planning_confirmed_supplier_scenarios (scenario_id, version, document)
        VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING RETURNING document`,
      [scenarioId, version, JSON.stringify(document)]);
      return acknowledged(inserted.rows[0]?.document ?? (await readVersion()).rows[0].document);
    });
  }

  async read({ id, version }, productIds) {
    const { rows } = await this.database.query(`SELECT document FROM planning_confirmed_supplier_scenarios
      WHERE scenario_id = $1 AND version = $2`, [id, version]);
    if (!rows[0]) throw new InputError('SOURCE_NOT_FOUND', 'Confirmed supplier version was not found.', 404, 'supplierScenario', id);
    const { suppliers, products } = rows[0].document;
    const selected = new Set(productIds);
    const offers = products.filter((product) => selected.has(product.productId)).flatMap((product) =>
      product.offers.map((quote) => ({ ...quote, productId: product.productId, stockUnit: product.stockUnit })));
    return { id, version, status: 'CONFIRMED', supplierIds: suppliers.map((supplier) => supplier.id), offers,
      provenance: [{ dataset: 'offers', source: id, version, simulated: true }] };
  }
}
