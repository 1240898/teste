import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { sourceServer, selection } from './helpers/input_server.mjs';
import { MemoryInputRecords } from '../../backend/src/modules/planning-inputs/infrastructure/InputRecords.js';

const line = (result, id) => result.lines.find((row) => row.productId === id);
async function scenario(options, run) {
  const server = await sourceServer(options);
  try { return await run(server); } finally { await server.close(); }
}
async function expectFailure(options, code, pick = selection()) {
  return scenario(options, async (server) => {
    const execution = await server.claim(pick), result = await server.load(execution);
    assert.equal(result.error?.code, code, JSON.stringify(result));
    assert.equal(result.error.executionId, execution.executionId);
    assert.equal(server.requests.filter((r) => r.method === 'PUT').length, 0);
    assert.equal(server.module.views.views.size, 0);
    return result;
  });
}

function changeViewProvenance(change) {
  return { intercept(req, res) {
    if (req.method === 'POST' && req.path.endsWith('/read-views')) {
      const json = res.json.bind(res);
      res.json = (body) => json({ ...body, provenance: change(body.provenance) });
    }
    return false;
  } };
}

test('AS06: preparation fixtures cannot replace selected saved catalogue IDs', async () =>
  expectFailure({}, 'FIXTURE_PRODUCT_CONFLICT', { ...selection(), preparationFixture: { id: 'five-medium', version: '1' } }));
test('opening stock keeps its own unit and rejects a kg balance against a g BOM before sealing', async () => {
  const picked = { ...selection(), stock: { type: 'saved', id: 'daily-sales', version: '1' } };
  const result = await expectFailure({ mutate(d) {
    if (d.id === 'daily-sales') Object.assign(d.openingStock.find((row) => row.productId === 'PROD-90003'),
      { availableUnits: 1, stockUnit: 'kg' });
  } }, 'INCOMPATIBLE_UNITS', picked);
  assert.equal(result.error.field, 'openingStock.stockUnit');
  assert.equal(result.error.reference, 'PROD-90003');
});
test('a saved balance without a unit is rejected before sealing', async () =>
  expectFailure({ mutate(d) { if (d.id === 'five-medium') delete d.openingStock[0].stockUnit; } }, 'MISSING_STOCK_UNIT'));

test('fixture-owned size consumption reaches AI01 without overriding catalogue consumption', async () => scenario({
  mutate(d) {
    if (d.id === 'five-medium') {
      d.pizzaConfigurations[0].components.push({ productId: 'SIM-DOUGH', quantity: 1 });
      d.openingStock.push({ productId: 'SIM-DOUGH', availableUnits: 1, stockUnit: 'unit' });
    }
    if (d.id === 'personalized') {
      d.products = [{ productId: 'SIM-DOUGH', isActive: true, isSellable: false, isPizza: false,
        isPizzaComponent: true, tracked: true, kind: 'aggregate', acquisitionType: 'PRODUCED', stockUnit: 'unit' }];
      d.recipes = [{ productId: 'SIM-DOUGH', yieldUnits: 2,
        ingredients: [{ productId: 'PROD-90003', unitsPerBatch: 10 }] }];
      d.componentConfigurations = [
        { productId: 'SIM-DOUGH', sizeId: 'PSIZE-0002', stockUnitsConsumed: 1 },
        { productId: 'PROD-90003', sizeId: 'PSIZE-0002', stockUnitsConsumed: 999 },
      ];
    }
  },
}, async (server) => {
  const picked = { ...selection(), preparationFixture: { id: 'personalized', version: '1' } };
  const result = await server.load(await server.claim(picked));
  assert.equal(result.error, undefined);
  assert.equal(line(result, 'SIM-DOUGH').requiredUnits, 5);
  assert.equal(line(result, 'SIM-DOUGH').plannedProductionUnits, 4);
  assert.equal(line(result, 'PROD-90003').requiredUnits, 620);
  assert.equal(line(result, 'PROD-90003').replenishmentUnits, 220);
}));
test('AS06: offers do not replace missing operational provenance', async () =>
  expectFailure(changeViewProvenance(() => []), 'MISSING_PROVENANCE', selection('iarti-demo', true)));
test('AS06: every selected group needs provenance', async () =>
  expectFailure(changeViewProvenance((rows) => rows.filter((p) => p.dataset !== 'stock')), 'MISSING_PROVENANCE'));
test('AS06: operational provenance does not replace missing offer provenance', async () =>
  expectFailure({ intercept(req, res) {
    if (req.method === 'POST' && req.path.endsWith('/supplier-offers')) {
      const json = res.json.bind(res); res.json = (body) => json({ ...body, provenance: [] });
    }
    return false;
  } }, 'MISSING_PROVENANCE', selection('iarti-demo', true)));
test('AS06: duplicate provenance groups are rejected', async () =>
  expectFailure(changeViewProvenance((rows) => [...rows, rows[0]]), 'DUPLICATE_REFERENCE'));
for (const [key, value] of [['source', 'other-source'], ['version', 'other-version'], ['simulated', false], ['retrievedAt', 'not-a-timestamp']])
  test(`AS06: provenance ${key} must match the source contract`, async () =>
    expectFailure(changeViewProvenance((rows) => rows.map((p) => p.dataset === 'stock' ? { ...p, [key]: value } : p)), 'INVALID_PROVENANCE'));

test('AS01/AS12: Prolog gathers selected HTTP records and AI01 reports 200 g missing', async () => scenario({}, async (server) => {
  const result = await server.load(await server.claim(selection()));
  assert.equal(result.error, undefined);
  assert.equal(line(result, 'PROD-90003').requiredUnits, 600);
  assert.equal(line(result, 'PROD-90003').replenishmentUnits, 200);
  assert.equal(result.simulation, true);
  const ids = server.requests.filter((r) => r.path.endsWith('/products')).flatMap((r) => r.body.productIds);
  assert.deepEqual([...new Set(ids)].sort(), ['PROD-90003', 'PROD-90020']);
  assert.equal(server.fixtures.get({ id: 'five-medium', version: '1' }).openingStock[0].availableUnits, 400);
}));
test('AS03: UTF-8 scenario identities survive the HTTP input boundary', async () => scenario({}, async (server) => {
  const selected = { ...selection(), scenarioId: 'Cenário-ç-東京' };
  const result = await server.load(await server.claim(selected));
  assert.equal(result.error, undefined); assert.equal(result.scenarioId, selected.scenarioId);
  assert.equal(line(result, 'PROD-90003').replenishmentUnits, 200);
}));

test('AS02: personalized compositions share catalogue identity but have distinct BOMs', async () => scenario({}, async (server) => {
  const result = await server.load(await server.claim(selection('personalized')));
  assert.equal(result.error, undefined);
  assert.equal(result.pizzaBoms.length, 2);
  assert.notEqual(result.pizzaBoms[0], result.pizzaBoms[1]);
  assert.equal(line(result, 'cheese').replenishmentUnits, 4);
  assert.equal(line(result, 'ham').replenishmentUnits, 1);
}));
test('AS02: preserved selectedComponentIds use the same size consumption rules', async () => scenario({
  mutate(d) { if (d.id !== 'personalized') return;
    for (const row of d.demandLines) { row.selectedComponentIds = row.selectedComponents.map((c) => c.productId); delete row.selectedComponents; } },
}, async (server) => {
  const result = await server.load(await server.claim(selection('personalized')));
  assert.equal(result.error, undefined); assert.equal(line(result, 'cheese').replenishmentUnits, 4);
  assert.equal(line(result, 'ham').replenishmentUnits, 1);
}));
test('AS05: conflicting personalisation representations are rejected', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'personalized') d.demandLines[0].selectedComponentIds = ['cheese']; } },
    'INVALID_BOM', selection('personalized')));

test('AS03: large HTTP dataset includes recursive and purchased aggregates', async () => scenario({}, async (server) => {
  const result = await server.load(await server.claim(selection('iarti-demo')));
  assert.equal(result.error, undefined);
  assert.equal(result.pizzaBoms.length, 24); assert.equal(result.items.length, 23); assert.equal(result.recipes.length, 2);
  assert.equal(line(result, 'pesto').replenishmentUnits, 180);
  assert.equal(line(result, 'classic-dough').remainingUnits, 2);
  assert.equal(server.requests.filter((r) => r.path.endsWith('/supplier-offers')).length, 0);
}));
test('AS03: chained dough and premix recipes are collected through successive HTTP reads', async () => scenario({}, async (server) => {
  const result = await server.load(await server.claim(selection('chained-dough')));
  assert.equal(result.error, undefined); assert.equal(result.items.length, 7); assert.equal(result.recipes.length, 2);
  assert.equal(line(result, 'PROD-90002').remainingUnits, 1);
  assert.deepEqual(result.lines.filter((r) => r.replenishmentUnits > 0).map((r) => [r.productId, r.replenishmentUnits]),
    [['PROD-90003', 4], ['PROD-90005', 1], ['PROD-90006', 2]]);
  assert.equal(server.requests.filter((r) => r.path.endsWith('/recipes')).length, 2);
}));
test('AS10: stocked preparations keep their validation graph; purchased and unrelated children stay outside', async () => scenario({
  mutate(d) {
    if (d.id !== 'iarti-demo') return;
    d.openingStock.find((s) => s.productId === 'classic-dough').availableUnits = 999;
    d.openingStock.find((s) => s.productId === 'thin-dough').availableUnits = 999;
    d.products.push({ productId: 'UNRELATED', isActive: false, isPizza: false, isSellable: false });
    d.recipes.push({ productId: 'pesto', yieldUnits: 1, ingredients: [{ productId: 'HIDDEN-CHILD', unitsPerBatch: 1 }] });
  },
}, async (server) => {
  const result = await server.load(await server.claim(selection('iarti-demo')));
  assert.equal(result.error, undefined); assert.equal(result.items.length, 23); assert.equal(result.recipes.length, 2);
  assert.equal(line(result, 'classic-dough').plannedProductionUnits, 0);
  const requested = server.requests.filter((r) => r.path.endsWith('/products')).flatMap((r) => r.body.productIds);
  assert(requested.includes('flour')); assert(!requested.includes('UNRELATED')); assert(!requested.includes('HIDDEN-CHILD'));
}));

test('AS04: dated forecast keeps 63 unique quotes, exact cents and deterministic order', async () => scenario({}, async (server) => {
  const result = await server.load(await server.claim(selection('iarti-demo', true)));
  assert.equal(result.error, undefined); assert.equal(result.offers.length, 63);
  const plan = result.requirementsPlan;
  assert.equal(plan.coverage, 'onTime');
  assert(plan.batches.length > 0);
  assert(plan.proposals.length > 0);
  assert(plan.days.every((row) => row.closingUnits >= 0 && row.requiredUnits === row.onTimeUnits));
  assert(result.pizzaDemand.some((d) => d.includes('date(2026,11,23)')));
  assert(result.pizzaDemand.some((d) => d.includes('date(2026,11,24)')));
  assert(result.offers.includes('offer("SUP-01","ham",7500,5000,1,none,"g")'));
  assert(result.offers.includes('offer("SUP-03","ham",500,250,2,none,"g")'));
  const ham = result.offers.filter((o) => o.includes(',"ham",'));
  assert(ham[0].includes(',5000,')); assert(ham[1].includes(',2000,')); assert(ham[2].includes(',250,'));
}));

test('AS04: direct sales retain explicit consumption, zero capacity and absent capacity', async () => scenario({}, async (server) => {
  const result = await server.load(await server.claim(selection('daily-sales', true)));
  assert.equal(result.error, undefined);
  assert.deepEqual(result.directSaleDemand, ['direct_sale(date(2026,11,24),"PROD-90030",6)']);
  assert(result.items.includes('item("PROD-90030",terminal,true,purchased,"unit",2)'));
  assert(result.offers.includes('offer("SUP-01","PROD-90030",850,10,1,0,"unit")'));
  assert(result.offers.includes('offer("SUP-02","PROD-90030",850,10,1,30,"unit")'));
  assert(result.offers.includes('offer("SUP-03","PROD-90030",850,10,1,none,"unit")'));
  assert.equal(result.referenceDate, 'date(2026,11,20)');
  assert.equal(result.forecast, 'forecast("daily-sales-forecast","1",date(2026,11,23),date(2026,11,24))');
}));
test('AS05: tracked direct sales require a consumption factor', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'daily-sales') delete d.products.find((p) => p.productId === 'PROD-90030').stockUnitsPerSale; } },
    'MISSING_CONSUMPTION', selection('daily-sales', true)));
test('AS04: pending receipts retain remaining quantities and dates without increasing opening stock', async () => scenario({
  mutate(d) { if (d.id === 'daily-sales') {
      d.pendingDeliveries = [{ receiptId: 'PO-01-L1', productId: 'PROD-90030',
        remainingUnits: 4, stockUnit: 'unit', expectedDeliveryDate: '2026-11-24' }];
      d.supplierScenario.offers = d.supplierScenario.offers.filter((offer) => offer.productId !== 'PROD-90030');
    } },
}, async (server) => {
  const result = await server.load(await server.claim(selection('daily-sales', true)));
  assert.equal(result.error, undefined);
  assert.deepEqual(result.pendingReceipts, ['pending_receipt("PO-01-L1","PROD-90030",4,date(2026,11,24))']);
  const day = result.requirementsPlan.days.find((r) => r.productId === 'PROD-90030' && r.requiredUnits === 12);
  assert.deepEqual([day.onTimeUnits, day.lateUnits, day.unfulfilledUnits], [4, 4, 4]);
  assert.equal(day.allocations.filter((a) => a.sourceRef.receiptId === 'PO-01-L1').length, 1);
  assert(result.openingStock.includes('stock("PROD-90030",4)'));
  assert(result.provenance.some((p) => p.dataset === 'receipts' && p.simulated));
}));
test('AS05: an unavailable pending-delivery source is not an empty delivery list', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'daily-sales') delete d.pendingDeliveries; } },
    'MISSING_RECEIPTS', selection('daily-sales', true)));
test('AS05: pending-delivery quantities must use the product stock unit', async () =>
  expectFailure({ mutate(d) { if (d.id === 'daily-sales') d.pendingDeliveries = [{ receiptId: 'PO-01-L1',
    productId: 'PROD-90030', remainingUnits: 6, stockUnit: 'pack', expectedDeliveryDate: '2026-11-24' }]; } },
  'INCOMPATIBLE_UNITS', selection('daily-sales', true)));
test('AS05: direct-sale stock tracking is explicit; untracked sales have no balance', async () => scenario({
  mutate(d) { if (d.id !== 'daily-sales') return;
    Object.assign(d.products.find((p) => p.productId === 'PROD-90030'), { tracked: false, stockUnit: null, stockUnitsPerSale: null });
    d.openingStock = d.openingStock.filter((s) => s.productId !== 'PROD-90030'); },
}, async (server) => {
  const result = await server.load(await server.claim(selection('daily-sales', true)));
  assert.equal(result.error, undefined);
  assert(result.items.includes('item("PROD-90030",terminal,false,purchased,none,none)'));
  assert(!result.openingStock.some((s) => s.includes('PROD-90030')));
  assert(!result.offers.some((o) => o.includes('PROD-90030')));
}));
test('AS05: forecast entries outside their period are rejected', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'daily-sales') d.demandLines[0].date = '2026-11-25'; } },
    'INVALID_DATE', selection('daily-sales', true)));
test('AS05: duplicate forecast date/product/size entries are rejected', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'daily-sales') d.demandLines.push(d.demandLines[0]); } },
    'DUPLICATE_REFERENCE', selection('daily-sales', true)));
test('AS07: source projection excludes customer personal and dietary information', async () => scenario({
  mutate(d) { if (d.id !== 'five-medium') return;
    d.demandLines[0].customerName = 'DO-NOT-TRANSFER'; d.demandLines[0].contacts = ['private'];
    d.products[0].dietaryProfile = { private: true }; },
}, async (server) => {
  const execution = await server.claim(selection()), result = await server.load(execution);
  assert.equal(result.error, undefined);
  const record = await server.module.records.get(execution.executionId);
  const retained = JSON.stringify(record);
  assert(!retained.includes('customerName')); assert(!retained.includes('contacts')); assert(!retained.includes('dietaryProfile'));
}));

test('AS05: missing tracked stock is rejected before retention', async () => {
  const result = await expectFailure({ mutate: (d) => { if (d.id === 'five-medium') d.openingStock = []; } }, 'MISSING_STOCK');
  assert.equal(result.error.reference, 'PROD-90003');
});
test('AS05: null tracked consumption is not assumed to be one unit', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'five-medium') d.componentConfigurations[0].stockUnitsConsumed = null; } }, 'MISSING_CONSUMPTION'));
test('AS01: missing pizza size is explicit', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'five-medium') delete d.demandLines[0].sizeId; } }, 'MISSING_FIELD'));
for (const group of ['products', 'sizes']) test(`AS06: inactive ${group} reject a fresh capture`, async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'five-medium') d[group][0].isActive = false; } }, 'INACTIVE_REFERENCE'));

test('AS05: duplicate supplier/product pairs are rejected', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'iarti-demo') d.supplierScenario.offers.push(d.supplierScenario.offers[0]); } }, 'DUPLICATE_REFERENCE', selection('iarti-demo', true)));
test('AS05: offers cannot invent a supplier missing from the confirmed scenario', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'iarti-demo') d.supplierScenario.offers[0].supplierId = 'UNKNOWN-SUPPLIER'; } },
    'UNKNOWN_SUPPLIER', selection('iarti-demo', true)));
test('AS05: a quote in kg for a product in g is rejected', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'iarti-demo') d.supplierScenario.offers[0].stockUnit = 'kg'; } }, 'INCOMPATIBLE_UNITS', selection('iarti-demo', true)));
test('AS05: missing price is not defaulted to zero', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'iarti-demo') delete d.supplierScenario.offers[0].priceEur; } }, 'MISSING_FIELD', selection('iarti-demo', true)));
test('AS04: a valid confirmed version with no offers preserves selected products', async () => scenario({
  mutate: (d) => { if (d.id === 'iarti-demo') d.supplierScenario.offers = []; },
}, async (server) => {
  const result = await server.load(await server.claim(selection('iarti-demo', true)));
  assert.equal(result.error, undefined); assert.deepEqual(result.offers, []); assert.equal(result.items.length, 23);
}));
test('AS04: unconfirmed supplier versions stop acquisition', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'iarti-demo') d.supplierScenario.status = 'IMPORTED'; } }, 'SUPPLIER_VERSION_NOT_CONFIRMED', selection('iarti-demo', true)));
test('AS06: supplier source versions are checked rather than relabelled as requested', async () =>
  expectFailure({ mutate: (d) => { if (d.id === 'iarti-demo') d.supplierScenario.version = 'different'; } },
    'SOURCE_VERSION_MISMATCH', selection('iarti-demo', true)));

test('AS08: retry and historical replay reuse retained inputs without source reads', async () => scenario({}, async (server) => {
  const selected = selection(), execution = await server.claim(selected);
  const first = await server.load(execution); assert.equal(first.error, undefined);
  const count = server.requests.filter((r) => r.path.endsWith('/read-views')).length;
  const retry = await server.load(execution);
  assert.equal(retry.snapshotId, first.snapshotId); assert.deepEqual(retry.lines, first.lines);
  const replaySelection = { ...selected, executionId: randomUUID(), mode: 'historicalReplay', replayedFrom: selected.executionId };
  const replay = await server.load(await server.claim(replaySelection));
  assert.equal(replay.error, undefined); assert.equal(replay.mode, 'historicalReplay');
  assert.equal(replay.replayedFrom, selected.executionId); assert.deepEqual(replay.lines, first.lines);
  assert.equal(server.requests.filter((r) => r.path.endsWith('/read-views')).length, count);
}));
test('AS11: an unknown execution never triggers a fresh capture', async () => scenario({}, async (server) => {
  const result = await server.load({ ...selection(), attemptNo: 1 });
  assert.equal(result.error.code, 'EXECUTION_NOT_FOUND');
  assert.equal(server.requests.filter((r) => r.path.endsWith('/read-views')).length, 0);
}));
test('AS07: rejected read credentials cannot disclose any inputs', async () => scenario({}, async (server) => {
  const execution = await server.claim(selection());
  const result = await server.load(execution, { LAPRIZZA_INPUT_READ_TOKEN: 'invalid-token' });
  assert.equal(result.error.code, 'SERVICE_UNAUTHENTICATED');
  assert.equal(server.requests.filter((r) => r.path.endsWith('/read-views')).length, 0);
  assert(!JSON.stringify(result).includes(server.credentials.readToken));
}));
test('AS07: HTTP redirects are not followed with service credentials', async () => scenario({
  intercept(req, res) {
    if (req.method === 'GET' && req.path.endsWith('/inputs')) {
      res.redirect(302, '/api/v1/redirect-target'); return true;
    } return false;
  },
}, async (server) => {
  const result = await server.load(await server.claim(selection()));
  assert(result.error); assert(!server.requests.some((r) => r.path.endsWith('/redirect-target')));
}));
test('AS07: the read credential cannot seal an input snapshot', async () => scenario({}, async (server) => {
  const execution = await server.claim(selection());
  const result = await server.load(execution, { LAPRIZZA_INPUT_RECORDS_TOKEN: server.credentials.readToken });
  assert.equal(result.error.code, 'SERVICE_FORBIDDEN');
  const record = await server.module.records.get(execution.executionId); assert.equal(record.snapshot, null);
}));
test('AS06: mixed read-view revisions fail without retaining a partial refresh', async () =>
  expectFailure({ intercept(req, res) {
    if (!req.path.endsWith('/stock')) return false;
    const original = res.json.bind(res);
    res.json = (body) => original({ ...body, revision: 'different-version' }); return false;
  } }, 'MIXED_INPUT_VERSIONS'));
test('AS11: a failed snapshot lookup does not fall back to current data', async () => scenario({
  intercept(req, res) {
    if (req.method === 'GET' && req.path.endsWith('/inputs')) {
      res.status(503).json({ error: { code: 'INPUT_SOURCE_UNAVAILABLE', message: 'Storage unavailable.' } }); return true;
    } return false;
  },
}, async (server) => {
  const result = await server.load(await server.claim(selection()));
  assert.equal(result.error.code, 'INPUT_SOURCE_UNAVAILABLE');
  assert.equal(server.requests.filter((r) => r.path.endsWith('/read-views')).length, 0);
}));
test('AS05: malformed nested source JSON returns a contextual diagnostic', async () => scenario({
  intercept(req, res) {
    if (req.method !== 'GET' || !req.path.endsWith('/inputs')) return false;
    res.status(409).json({ error: 'malformed-error-object' }); return true;
  },
}, async (server) => {
  const execution = await server.claim(selection()), result = await server.load(execution);
  assert.equal(result.error.code, 'INVALID_SOURCE_RESPONSE');
  assert.equal(result.error.executionId, execution.executionId);
  assert.equal(server.requests.filter((r) => r.path.endsWith('/read-views')).length, 0);
}));
test('AS05: an unsafe integer in source JSON is rejected before JavaScript can round it', async () => scenario({
  intercept(req, res) {
    if (req.method !== 'GET' || !req.path.endsWith('/inputs')) return false;
    res.status(200).type('json').send('{"quantity":9007199254740993}'); return true;
  },
}, async (server) => {
  const result = await server.load(await server.claim(selection()));
  assert.equal(result.error.code, 'JSON_INTEGER_OUT_OF_RANGE');
  assert.equal(result.error.reference, '9007199254740993');
}));
test('AS11: changed selectors cannot reuse an execution identity', async () => scenario({}, async (server) => {
  const execution = await server.claim(selection());
  const result = await server.load({ ...execution, stock: { type: 'current' } });
  assert.equal(result.error.code, 'EXECUTION_SELECTION_CONFLICT');
  assert.equal(server.requests.filter((r) => r.path.endsWith('/read-views')).length, 0);
}));
test('AS11: an expired attempt cannot bind its candidate', async () => {
  let now = Date.now();
  const records = new MemoryInputRecords({ clock: () => now, leaseMs: 1000 });
  const bind = records.bind.bind(records); records.bind = (...args) => { now += 1001; return bind(...args); };
  return scenario({ records }, async (server) => {
    const execution = await server.claim(selection()), result = await server.load(execution);
    assert.equal(result.error.code, 'STALE_ATTEMPT');
    assert.equal((await records.get(execution.executionId)).snapshot, null);
  });
});
test('AS11: competing captures return the same retained winner', async () => {
  const records = new MemoryInputRecords();
  const bind = records.bind.bind(records); let arrivals = 0, release;
  const gate = new Promise((resolve) => { release = resolve; });
  records.bind = async (...args) => { if (++arrivals === 2) release(); await gate; return bind(...args); };
  return scenario({ records }, async (server) => {
    const execution = await server.claim(selection());
    const [one, two] = await Promise.all([server.load(execution), server.load(execution)]);
    assert.equal(one.error, undefined); assert.equal(two.error, undefined);
    assert.equal(arrivals, 2); assert.equal(one.snapshotId, two.snapshotId); assert.deepEqual(one.lines, two.lines);
  });
});

test('AI02 repeats the sealed plan and replays original quantities and allocation references', async () =>
  scenario({}, async (server) => {
    const selected = selection('daily-sales', true);
    const execution = await server.claim(selected);
    const { requirementsPlan: first } = await server.load(execution);
    assert.equal(first.costCents, 1350);
    assert.equal(first.simulation, true);
    assert.equal(first.referenceDate, '2026-11-20');
    const count = server.requests.filter((r) => r.path.endsWith('/read-views')).length;
    assert.deepEqual((await server.load(execution)).requirementsPlan, first);
    const replay = (await server.load(await server.claim({ ...selected, executionId: randomUUID(),
      mode: 'historicalReplay', replayedFrom: execution.executionId }))).requirementsPlan;
    assert.deepEqual(replay.proposals, first.proposals);
    const originalSources = replay.days.map((day) => ({ ...day, allocations: day.allocations.map((a) => {
      if (a.sourceType !== 'openingStock') return a;
      assert.equal(a.sourceRef.snapshotId, replay.snapshotId);
      return { ...a, sourceRef: { ...a.sourceRef, snapshotId: first.snapshotId } };
    }) }));
    assert.deepEqual(originalSources, first.days);
    assert.equal(replay.referenceDate, first.referenceDate);
    assert.equal(server.requests.filter((r) => r.path.endsWith('/read-views')).length, count);
  }));
