import { randomUUID } from 'node:crypto';
import { InputError, safeInteger } from '../domain/InputError.js';

const pick = (record, fields) => Object.fromEntries(fields.filter((key) =>
  Object.hasOwn(record, key)).map((key) => [key, record[key]]));
const component = (row) => pick(row, ['productId', 'quantity']);
const arrayField = (record, key, project) => !Object.hasOwn(record, key) ? {} :
  { [key]: Array.isArray(record[key]) ? record[key].map(project) : record[key] };
const demandLine = (row) => ({ ...pick(row, ['type', 'productId', 'sizeId', 'quantity', 'date', 'selectedComponentIds']),
  ...arrayField(row, 'selectedComponents', component) });
const product = (row) => pick(row, ['productId', 'isActive', 'isSellable', 'isPizza', 'isPizzaComponent',
  'kind', 'acquisitionType', 'tracked', 'stockUnit', 'stockUnitsPerSale', 'planningOrigin']);

// A view exposes raw records. Pizza resolution, graph traversal and KB assembly
// remain in Prolog. No source method performs stock consumption.
export class PlanningInputSource {
  constructor({ database, fixtures, demandReader, incomingReader }) {
    Object.assign(this, { database, fixtures, demandReader, incomingReader });
  }

  async open(selection) {
    const receiptSelector = selection.receipts ?? selection.stock;
    const planning = selection.calculation === 'REQUIREMENTS_PLANNING';
    const live = selection.catalogue.type === 'current' || selection.stock.type === 'current' || (planning && receiptSelector.type === 'current');
    const tx = live ? await this.database.openReadView() : null;
    try {
      const demandData = selection.demand.type === 'fixture'
        ? this.fixtures.get(selection.demand)
        : await this.demandReader?.read(selection.demand, tx);
      if (!demandData)
        throw new InputError('SOURCE_NOT_FOUND', 'The selected order/forecast source is unavailable.', 404, 'demand');
      if (!Array.isArray(demandData.demandLines))
        throw new InputError('INVALID_DEMAND', 'Demand lines must be an array.', 422, 'demandLines');
      const catalogue = selection.catalogue.type === 'saved' ? this.fixtures.get(selection.catalogue) : null;
      const stock = selection.stock.type === 'saved' ? this.fixtures.get(selection.stock) : null;
      const preparation = selection.preparationFixture ? this.fixtures.get(selection.preparationFixture) : null;
      const receipts = planning && receiptSelector.type === 'saved' ? this.fixtures.get(receiptSelector) : null;
      const retrievedAt = tx?.retrievedAt ?? new Date().toISOString();
      const provenance = [
        { dataset: 'demand', source: selection.demand.id, version: selection.demand.version,
          simulated: selection.demand.type === 'fixture', ...(!selection.demand.version && { retrievedAt }) },
        ...['catalogue', 'stock'].map((dataset) => ({ dataset,
          source: selection[dataset].type === 'current' ? 'backoffice' : selection[dataset].id,
          ...(selection[dataset].type === 'current' ? { retrievedAt } : { version: selection[dataset].version }),
          simulated: selection[dataset].type === 'saved' })),
        ...(preparation ? [{ dataset: 'recipes', source: preparation.id, version: preparation.version, simulated: true }] : []),
        ...(planning ? [{ dataset: 'receipts', source: receiptSelector.type === 'saved' ? receiptSelector.id : 'backoffice',
          ...(receiptSelector.type === 'saved' ? { version: receiptSelector.version } : { retrievedAt }),
          simulated: receiptSelector.type === 'saved' }] : []),
      ];
      return new SourceView({ tx, catalogue, stock, preparation, receipts, incomingReader: this.incomingReader, demandData,
        info: { viewId: randomUUID(), revision: tx?.revision ?? randomUUID(), retrievedAt,
          cataloguePolicy: catalogue ? 'explicit-fixture' : 'pizza-components-terminal',
          demandLines: demandData.demandLines.map(demandLine),
          forecast: demandData.forecast ? pick(demandData.forecast, ['id', 'version', 'startDate', 'endDate']) : null, provenance } });
    } catch (error) { await tx?.close(); throw error; }
  }
}

class SourceView {
  constructor(options) { Object.assign(this, options); }

  async read(group, productIds, sizeIds = []) {
    const { catalogue, preparation, stock, tx } = this;
    const selected = (records, field = 'productId') =>
      (records ?? []).filter((row) => productIds.includes(row[field]));
    if (group === 'incoming-deliveries') {
      const incoming = this.receipts ? this.receipts.pendingDeliveries
        : await this.incomingReader?.read(productIds, tx);
      if (!Array.isArray(incoming)) throw new InputError('MISSING_RECEIPTS',
        'An explicit set of unreceived deliveries is required; unavailable does not mean empty.', 422, 'pendingDeliveries');
      return selected(incoming).map((row) => pick(row, ['receiptId', 'productId', 'remainingUnits', 'stockUnit', 'expectedDeliveryDate']));
    }
    if (group === 'recipes') return selected([...(catalogue?.recipes ?? []), ...(preparation?.recipes ?? [])]).map((row) => ({
      ...pick(row, ['productId', 'yieldUnits']), ...arrayField(row, 'ingredients', (i) => pick(i, ['productId', 'unitsPerBatch'])) }));
    if (group === 'stock') {
      if (stock) return selected(stock.openingStock).map((row) => pick(row, ['productId', 'availableUnits', 'stockUnit']));
      const { rows } = await tx.query(`SELECT s.product_id, s.available_units, ps.stock_unit FROM stock_information s
        LEFT JOIN planning_product_settings ps ON ps.product_id = s.product_id
        WHERE s.ended_at IS NULL AND s.product_id = ANY($1::text[]) ORDER BY s.product_id`, [productIds]);
      return rows.map((row) => ({ productId: row.product_id, stockUnit: row.stock_unit,
        availableUnits: safeInteger(row.available_units, 'openingStock.availableUnits', row.product_id) }));
    }
    if (group === 'products') {
      if (catalogue) return this.withPreparations(selected(catalogue.products).map(product), selected(preparation?.products));
      const { rows } = await tx.query(`SELECT p.id, p.is_active, p.is_sellable,
        p.is_pizza_component, p.pricing_mode, p.acquisition_type,
        s.product_id IS NOT NULL AS tracked, ps.stock_unit, ps.stock_units_per_sale
        FROM products p LEFT JOIN stock_information s ON s.product_id = p.id AND s.ended_at IS NULL
        LEFT JOIN planning_product_settings ps ON ps.product_id = p.id
        WHERE p.id = ANY($1::text[]) ORDER BY p.id`, [productIds]);
      const records = rows.map((row) => ({ productId: row.id, isActive: row.is_active,
        isSellable: row.is_sellable, isPizzaComponent: row.is_pizza_component,
        isPizza: row.is_sellable && !row.is_pizza_component && row.pricing_mode === 'COMPONENT_BASED',
        acquisitionType: row.acquisition_type, tracked: row.tracked, stockUnit: row.stock_unit,
        stockUnitsPerSale: row.stock_units_per_sale == null ? null
          : safeInteger(row.stock_units_per_sale, 'products.stockUnitsPerSale', row.id) }));
      return this.withPreparations(records, selected(preparation?.products));
    }
    if (group === 'sizes') {
      if (catalogue) return (catalogue.sizes ?? []).filter((row) => sizeIds.includes(row.sizeId)).map((row) => pick(row, ['sizeId', 'isActive']));
      const { rows } = await tx.query('SELECT id, active AS is_active FROM pizza_sizes WHERE id = ANY($1::text[]) ORDER BY id', [sizeIds]);
      return rows.map((row) => ({ sizeId: row.id, isActive: row.is_active }));
    }
    if (group === 'pizza-configurations') {
      if (catalogue) return selected(catalogue.pizzaConfigurations).map((row) => ({
        productId: row.productId, ...arrayField(row, 'components', component) }));
      const { rows } = await tx.query(`SELECT parent_product_id, child_product_id, quantity
        FROM product_composition_items WHERE parent_product_id = ANY($1::text[])
        ORDER BY parent_product_id, child_product_id`, [productIds]);
      return productIds.map((productId) => ({ productId, components: rows
        .filter((row) => row.parent_product_id === productId)
        .map((row) => ({ productId: row.child_product_id,
          quantity: safeInteger(row.quantity, 'pizzaConfigurations.quantity', productId) })) }));
    }
    if (group === 'component-configurations') {
      // Resolve ownership with the same collision checks as the product read.
      const products = await this.read('products', productIds);
      const fixtureIds = new Set(products.filter((p) => p.planningOrigin === 'fixture'
        && preparation?.products?.some((entry) => entry.productId === p.productId)).map((p) => p.productId));
      const configurations = (records, owns) => selected(records)
        .filter((row) => sizeIds.includes(row.sizeId) && owns(row.productId))
        .map((row) => pick(row, ['productId', 'sizeId', 'stockUnitsConsumed']));
      const extras = configurations(preparation?.componentConfigurations, (id) => fixtureIds.has(id));
      if (catalogue) return [...configurations(catalogue.componentConfigurations, (id) => !fixtureIds.has(id)), ...extras];
      const { rows } = await tx.query(`SELECT product_id, size_id, stock_units_consumed
        FROM component_size_configurations WHERE product_id = ANY($1::text[]) AND size_id = ANY($2::text[])
        ORDER BY product_id, size_id`, [productIds.filter((id) => !fixtureIds.has(id)), sizeIds]);
      return [...rows.map((row) => ({ productId: row.product_id, sizeId: row.size_id,
        stockUnitsConsumed: row.stock_units_consumed == null ? null
          : safeInteger(row.stock_units_consumed, 'componentConfigurations.stockUnitsConsumed', row.product_id) })), ...extras];
    }
    throw new InputError('INVALID_GROUP', 'Unknown planning source group.', 400);
  }

  withPreparations(records, preparations) {
    // Preparations add fixture-only IDs; they never replace catalogue eligibility,
    // roles, classification or canonical units, even when the run is simulated.
    const collision = preparations.find((p) => records.some((r) => r.productId === p.productId));
    if (collision) throw new InputError('FIXTURE_PRODUCT_CONFLICT',
      'Preparation fixtures cannot replace a selected catalogue product.', 422, 'preparationFixture.products', collision.productId);
    return [...records, ...preparations.map((p) => ({ ...product(p), planningOrigin: 'fixture' }))];
  }

  close() { return this.tx?.close(); }
}
