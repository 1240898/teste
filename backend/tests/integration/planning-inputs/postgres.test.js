import '../../../src/shared/config/index.js';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../../src/app.js';
import { createPlanningInputModule } from '../../../src/modules/planning-inputs/index.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { PlanningInputSource } from '../../../src/modules/planning-inputs/infrastructure/PlanningInputSource.js';
import { FixtureRegistry } from '../../../src/modules/planning-inputs/infrastructure/FixtureRegistry.js';
import { PostgresInputRecords } from '../../../src/modules/planning-inputs/infrastructure/InputRecords.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

describeDatabase('AI06 PostgreSQL migrations', () => {
  test('upgrades a database migrated through GDP01 and can be run again', async () => {
    const database = await isolatedDatabase();
    try {
      await migrate(database, undefined, { throughVersion: '0030_customer_health_data_consent.sql' });
      const readLedger = async () => (await database.query(
        'SELECT name, checksum FROM public.schema_migrations ORDER BY name')).rows;
      const baseline = await readLedger();
      expect(baseline.at(-1).name).toBe('0030_customer_health_data_consent.sql');
      expect(await migrate(database)).toBe(3);
      expect((await readLedger()).slice(0, baseline.length)).toEqual(baseline);
      expect((await readLedger()).slice(baseline.length).map((row) => row.name)).toEqual([
        '0031_planning_inputs.sql',
        '0032_confirmed_supplier_scenarios.sql',
        '0033_forecast_planning.sql',
      ]);
      for (const table of ['planning_product_settings', 'planning_input_runs', 'planning_confirmed_supplier_scenarios']) {
        const { rows } = await database.query('SELECT to_regclass($1) IS NOT NULL AS exists', [table]);
        expect(rows[0].exists).toBe(true);
      }
      expect(await migrate(database)).toBe(0);
    } finally {
      await database.close();
    }
  });
});

const selection = () => ({ executionId: randomUUID(), scenarioId: 'database-input-test', mode: 'current', calculation: 'BOM',
  demand: { type: 'fixture', id: 'five-medium', version: '1' },
  catalogue: { type: 'current' }, stock: { type: 'current' } });

describeDatabase('AI06 PostgreSQL coherent reads and immutable input retention', () => {
  let database, source, records;
  beforeAll(async () => {
    database = await isolatedDatabase(); await migrate(database);
    source = new PlanningInputSource({ database, fixtures: await FixtureRegistry.bundled() });
    records = new PostgresInputRecords(database);
    await database.query("INSERT INTO product_categories(id,name) VALUES ('CAT-00001','Planning test')");
    await database.query(`INSERT INTO products(id,name,description,category_id,is_sellable,is_pizza_component,
      acquisition_type,pricing_mode,base_price_amount,base_price_currency,pizza_component_type_id)
      VALUES ('PROD-90003','Cheese','Test ingredient','CAT-00001',true,true,'PURCHASED','FIXED',0,'EUR','type-03')`);
    await database.query(`INSERT INTO products(id,name,description,category_id,is_sellable,is_pizza_component,
      acquisition_type,pricing_mode,base_price_amount,base_price_currency)
      VALUES ('PROD-90020','Cheese pizza','Test pizza','CAT-00001',true,false,'PRODUCED','COMPONENT_BASED',NULL,NULL)`);
    await database.query("INSERT INTO product_composition_items(parent_product_id,child_product_id,quantity) VALUES ('PROD-90020','PROD-90003',1)");
    await database.query("INSERT INTO pizza_sizes(id,name) VALUES ('PSIZE-0002','Medium')");
    await database.query(`INSERT INTO component_size_configurations(product_id,size_id,price_amount,price_currency,stock_units_consumed)
      VALUES ('PROD-90003','PSIZE-0002',1,'EUR',120)`);
    await database.query(`INSERT INTO stock_information(id,stock_code,product_id,available_units)
      VALUES ($1,'STOCK-90003','PROD-90003',400)`, [randomUUID()]);
    await database.query("INSERT INTO planning_product_settings(product_id,stock_unit,stock_units_per_sale) VALUES ('PROD-90003','g',120)");
  });
  afterAll(async () => database?.close());
  beforeEach(async () => {
    await database.query("UPDATE products SET is_active=true WHERE id='PROD-90003'");
    await database.query("UPDATE stock_information SET available_units=400 WHERE product_id='PROD-90003'");
    await database.query("UPDATE component_size_configurations SET stock_units_consumed=120 WHERE product_id='PROD-90003'");
  });

  test('a preparation fixture cannot reactivate or replace a current catalogue product', async () => {
    await database.query("UPDATE products SET is_active=false WHERE id='PROD-90003'");
    const view = await source.open({ ...selection(), preparationFixture: { id: 'five-medium', version: '1' } });
    try {
      await expect(view.read('products', ['PROD-90003'])).rejects.toMatchObject({
        code: 'FIXTURE_PRODUCT_CONFLICT', reference: 'PROD-90003', status: 422 });
      expect((await database.query("SELECT is_active FROM products WHERE id='PROD-90003'")).rows[0].is_active).toBe(false);
    } finally { await view.close(); }
  });
  test('fixture-only preparations can coexist with unchanged current product records', async () => {
    const bundled = await FixtureRegistry.bundled();
    const fixtures = new FixtureRegistry([...bundled.datasets.values(), { id: 'preparations', version: '1',
      products: [{ productId: 'SIM-DOUGH', isActive: true, isPizza: false, isSellable: false,
        isPizzaComponent: true, kind: 'aggregate', acquisitionType: 'PRODUCED', tracked: true, stockUnit: 'unit' }],
      recipes: [{ productId: 'SIM-DOUGH', yieldUnits: 2, ingredients: [{ productId: 'PROD-90003', unitsPerBatch: 120 }] }] }]);
    const mixed = new PlanningInputSource({ database, fixtures });
    const view = await mixed.open({ ...selection(), preparationFixture: { id: 'preparations', version: '1' } });
    try {
      const rows = await view.read('products', ['PROD-90003', 'SIM-DOUGH']);
      expect(rows.find((r) => r.productId === 'PROD-90003')).toMatchObject({ isActive: true, stockUnit: 'g', acquisitionType: 'PURCHASED' });
      expect(rows.find((r) => r.productId === 'PROD-90003').planningOrigin).toBeUndefined();
      expect(rows.find((r) => r.productId === 'SIM-DOUGH')).toMatchObject({ kind: 'aggregate', planningOrigin: 'fixture' });
      expect((await view.read('recipes', ['SIM-DOUGH']))[0].yieldUnits).toBe(2);
    } finally { await view.close(); }
  });

  test.each(['bind', 'claim'])('expiry is checked after waiting for a row lock during %s', async (operation) => {
    const leased = new PostgresInputRecords(database, { leaseMs: 1000 });
    const picked = selection(), first = await leased.claim(picked);
    let unlock, locked;
    const gate = new Promise((resolve) => { unlock = resolve; });
    const ready = new Promise((resolve) => { locked = resolve; });
    const holder = database.withTransaction(async (tx) => {
      await tx.query('SELECT execution_id FROM planning_input_runs WHERE execution_id=$1 FOR UPDATE', [picked.executionId]);
      locked(); await gate;
    });
    await Promise.race([ready, holder]);
    const pending = (operation === 'bind'
      ? leased.bind(picked.executionId, first.attemptNo, { schemaVersion: 1, selection: picked })
      : leased.claim(picked)).then((value) => ({ value }), (error) => ({ error }));
    try { await delay(1500); } finally { unlock(); await holder; }
    const outcome = await pending;
    if (operation === 'bind') {
      expect(outcome.error).toMatchObject({ code: 'STALE_ATTEMPT' });
      expect((await leased.get(picked.executionId)).snapshot).toBeNull();
    } else {
      expect(outcome.error).toBeUndefined();
      expect(outcome.value.attemptNo).toBe(first.attemptNo + 1);
    }
  });

  test('a recipe/stock update during capture cannot mix old and new versions', async () => {
    const view = await source.open(selection());
    try {
      const before = await view.read('component-configurations', ['PROD-90003'], ['PSIZE-0002']);
      expect(before[0].stockUnitsConsumed).toBe(120);
      await database.withTransaction(async (tx) => {
        await tx.query("UPDATE component_size_configurations SET stock_units_consumed=150 WHERE product_id='PROD-90003'");
        await tx.query("UPDATE stock_information SET available_units=800 WHERE product_id='PROD-90003'");
      });
      expect((await view.read('stock', ['PROD-90003']))[0].availableUnits).toBe(400);
      expect((await view.read('component-configurations', ['PROD-90003'], ['PSIZE-0002']))[0].stockUnitsConsumed).toBe(120);
      const fresh = await source.open(selection());
      try {
        expect((await fresh.read('stock', ['PROD-90003']))[0].availableUnits).toBe(800);
        expect((await fresh.read('component-configurations', ['PROD-90003'], ['PSIZE-0002']))[0].stockUnitsConsumed).toBe(150);
      } finally { await fresh.close(); }
    } finally { await view.close(); }
  });
  test('the source transaction rejects writes and leaves persistent stock unchanged', async () => {
    const view = await source.open(selection());
    try {
      await expect(view.tx.query("UPDATE stock_information SET available_units=0 WHERE product_id='PROD-90003'"))
        .rejects.toMatchObject({ code: '25006' });
    } finally { await view.close(); }
    expect((await database.query("SELECT available_units FROM stock_information WHERE product_id='PROD-90003'")).rows[0].available_units).toBe(400);
  });
  test('size eligibility uses the actual pizza_sizes.active column and settings stay explicit', async () => {
    const view = await source.open(selection());
    try {
      expect((await view.read('sizes', [], ['PSIZE-0002']))[0]).toEqual({ sizeId: 'PSIZE-0002', isActive: true });
      expect((await view.read('products', ['PROD-90003']))[0]).toMatchObject({ tracked: true, stockUnit: 'g', stockUnitsPerSale: 120 });
    } finally { await view.close(); }
  });
  test('two competing snapshot writes retain the first winner atomically', async () => {
    const picked = selection(), claim = await records.claim(picked);
    const [one, two] = await Promise.all([
      records.bind(picked.executionId, claim.attemptNo, { selection: picked, marker: 'one' }),
      records.bind(picked.executionId, claim.attemptNo, { selection: picked, marker: 'two' }),
    ]);
    expect(one.snapshot).toEqual(two.snapshot);
    expect((await records.get(picked.executionId)).snapshot).toEqual(one.snapshot);
  });
  test('expired attempts cannot write; retries are fenced and sealed inputs survive late writes', async () => {
    const picked = selection(), first = await records.claim(picked);
    await database.query("UPDATE planning_input_runs SET expires_at='2000-01-01' WHERE execution_id=$1", [picked.executionId]);
    await expect(records.bind(picked.executionId, first.attemptNo, { selection: picked })).rejects.toMatchObject({ code: 'STALE_ATTEMPT' });
    const second = await records.claim(picked); expect(second.attemptNo).toBe(first.attemptNo + 1);
    await expect(records.bind(picked.executionId, first.attemptNo, { selection: picked })).rejects.toMatchObject({ code: 'STALE_ATTEMPT' });
    const saved = await records.bind(picked.executionId, second.attemptNo, { selection: picked, marker: 'saved' });
    const late = await records.bind(picked.executionId, first.attemptNo, { selection: picked, marker: 'late' });
    expect(late.snapshot).toEqual(saved.snapshot);
  });
  test('a replay retains the original document and cannot change its business selection', async () => {
    const picked = selection(), claim = await records.claim(picked);
    const original = await records.bind(picked.executionId, claim.attemptNo, { selection: picked, marker: 'original' });
    const replay = { ...picked, executionId: randomUUID(), mode: 'historicalReplay', replayedFrom: picked.executionId };
    await records.claim(replay);
    expect((await records.get(replay.executionId)).snapshot.document).toEqual(original.snapshot.document);
    await expect(records.claim({ ...replay, executionId: randomUUID(), stock: { type: 'saved', id: 'other', version: '1' } }))
      .rejects.toMatchObject({ code: 'EXECUTION_SELECTION_CONFLICT' });
  });

  const testProlog = process.env.SWIPL ? test : test.skip;
  testProlog.each(['BOM', 'REQUIREMENTS_PLANNING'])('real Prolog HTTP loads %s from the application API without consuming stock', async (calculation) => {
    const credentials = { readToken: randomUUID(), recordsToken: randomUUID(), supplierConfirmToken: randomUUID() };
    const module = createPlanningInputModule({ database, fixtures: await FixtureRegistry.bundled(), credentials });
    const app = createApp({ planningInputModule: module });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    try {
      const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`, picked = selection();
      if (calculation === 'REQUIREMENTS_PLANNING') {
        const confirmUrl = baseUrl + '/internal/planning-records/supplier-scenarios/web07-test/versions/1';
        const headers = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
        const payload = { suppliers: [{ id: 'WEB07-S1' }], products: [{ productId: 'PROD-90003', stockUnit: 'g',
          offers: [{ supplierId: 'WEB07-S1', priceEur: '11.50', coveredUnits: 250, leadTimeDays: 1 }] }] };
        const offersUrl = baseUrl + '/internal/planning/supplier-offers';
        const read = () => fetch(offersUrl, { method: 'POST', headers: headers(credentials.readToken),
          body: JSON.stringify({ id: 'web07-test', version: '1', productIds: ['PROD-90003'] }) });
        const confirm = (token, body) => fetch(confirmUrl, { method: 'PUT', headers: headers(token), body: JSON.stringify(body) });
        expect((await read()).status).toBe(404);
        expect((await confirm(credentials.readToken, payload)).status).toBe(403);
        expect((await confirm(credentials.recordsToken, payload)).status).toBe(403);
        const response = await confirm(credentials.supplierConfirmToken, payload);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ status: 'CONFIRMED', version: '1' });
        expect((await confirm(credentials.supplierConfirmToken, payload)).status).toBe(200);
        expect((await confirm(credentials.supplierConfirmToken, { ...payload, products: [] })).status).toBe(409);
        Object.assign(picked, { calculation, demand: { type: 'fixture', id: 'daily-sales', version: '1' },
          receipts: { type: 'saved', id: 'daily-sales', version: '1' },
          supplierScenario: { id: 'web07-test', version: '1' }, referenceDate: '2026-11-20' });
        // The saved daily forecast also contains a drink. Set it up in the live catalogue.
        await database.query(`INSERT INTO products(id,name,description,category_id,is_sellable,is_pizza_component,
          acquisition_type,pricing_mode,base_price_amount,base_price_currency)
          VALUES ('PROD-90030','Drink','Test drink','CAT-00001',true,false,'PURCHASED','FIXED',1,'EUR')`);
        await database.query("INSERT INTO planning_product_settings(product_id,stock_unit,stock_units_per_sale) VALUES ('PROD-90030','unit',2)");
        await database.query("INSERT INTO stock_information(id,stock_code,product_id,available_units) VALUES ($1,'STOCK-90030','PROD-90030',4)", [randomUUID()]);
      }
      const stockBefore = (await database.query('SELECT product_id, available_units FROM stock_information ORDER BY product_id')).rows;
      const claim = await records.claim(picked);
      const child = spawn(process.env.SWIPL, ['-q', '-s', 'ai/demo_inputs.pl', '-g', 'demo_inputs', '-t', 'halt'], {
        cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
        env: { ...process.env, LAPRIZZA_INPUT_API_URL: baseUrl,
          LAPRIZZA_INPUT_READ_TOKEN: credentials.readToken, LAPRIZZA_INPUT_RECORDS_TOKEN: credentials.recordsToken },
      });
      let stdout = '', stderr = '';
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', (data) => { stdout += data; }); child.stderr.on('data', (data) => { stderr += data; });
      child.stdin.end(JSON.stringify({ ...picked, attemptNo: claim.attemptNo }));
      const timer = setTimeout(() => child.kill(), 10000);
      const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); }).finally(() => clearTimeout(timer));
      expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
      const result = JSON.parse(stdout); expect(result.error).toBeUndefined();
      if (calculation === 'BOM') {
        expect(result.lines[0]).toMatchObject({ requiredUnits: 600, withdrawnUnits: 400, replenishmentUnits: 200 });
      } else {
        expect(result.requirementsPlan).toMatchObject({ costCents: 1150, coverage: 'partial' });
        expect(result.requirementsPlan.days).toContainEqual(expect.objectContaining({
          productId: 'PROD-90030', requiredUnits: 12, onTimeUnits: 4, unfulfilledUnits: 8,
        }));
        expect(result.offers).toEqual(['offer("WEB07-S1","PROD-90003",1150,250,1,none,"g")']);
        expect(result.openingStock).toContain('stock("PROD-90003",400)');
        expect(result.pizzaDemand[0]).toContain('date(2026,11,23)');
        expect(result.provenance).toContainEqual({ dataset: 'offers', source: 'web07-test', version: '1', simulated: true });
      }
      expect((await database.query('SELECT product_id, available_units FROM stock_information ORDER BY product_id')).rows).toEqual(stockBefore);
      expect(result.provenance.filter((p) => !p.simulated).map((p) => p.dataset)).toEqual(['catalogue', 'stock']);
      expect((await records.get(picked.executionId)).snapshot).not.toBeNull();
      expect((await database.query("SELECT available_units FROM stock_information WHERE product_id='PROD-90003'")).rows[0].available_units).toBe(400);
    } finally { await module.dispose(); await new Promise((resolve) => server.close(resolve)); }
  }, 20000);
});
