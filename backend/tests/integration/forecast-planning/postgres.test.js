import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { createApp } from '../../../src/app.js';
import { createForecastModule } from '../../../src/modules/forecast-planning/index.js';
import {
  createProcurementScenarios,
  backofficeClient,
} from '../../../src/modules/procurement-scenarios/index.js';
import { createPlanningInputModule } from '../../../src/modules/planning-inputs/index.js';
import { FixtureRegistry } from '../../../src/modules/planning-inputs/infrastructure/FixtureRegistry.js';
import { AuthMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/authMiddleware.js';

const pizza = 'PROD-90020',
  drink = 'PROD-90030',
  cheese = 'PROD-90003',
  size = 'PSIZE-0002';
function forecast(name, first, second) {
  return {
    creationRequestId: randomUUID(),
    name,
    startDate: '2026-11-23',
    endDate: '2026-11-24',
    entries: [
      { date: '2026-11-23', productId: pizza, sizeId: size, quantity: first },
      { date: '2026-11-24', productId: pizza, sizeId: size, quantity: second },
      { date: '2026-11-23', productId: drink, quantity: 6 },
    ],
  };
}
const quote = {
  supplierId: 'A',
  priceEur: '0.50',
  coveredUnits: 5,
  leadTimeDays: 0,
};
const offers = {
  suppliers: [{ id: 'A' }, { id: 'B' }],
  products: [
    {
      productId: drink,
      stockUnit: 'unit',
      offers: [
        quote,
        { ...quote, supplierId: 'B', priceEur: '0.00', dailyLimit: 0 },
      ],
    },
  ],
};
const describeDb =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
describeDb('WEB07 public preparation and private Prolog input path', () => {
  let db, inputs, server, url, fixtures;
  const credentials = {
    readToken: randomUUID(),
    recordsToken: randomUUID(),
    supplierConfirmToken: randomUUID(),
  };
  const call = async (method, path, body, token = 'manager') => {
    const response = await fetch(url + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: 'Bearer ' + token }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
    };
  };
  const postForecast = (body) => call('POST', '/planning/forecasts', body);
  const preview = (body) =>
    call('POST', '/planning/supplier-scenario-previews', body);
  const confirm = (id) =>
    call('PUT', '/planning/supplier-scenario-previews/' + id + '/confirmation');
  beforeAll(async () => {
    db = await isolatedDatabase();
    await migrate(db);
    await db.query(
      "INSERT INTO product_categories(id,name) VALUES ('CAT-00001','Planning')",
    );
    await db.query(`INSERT INTO products(id,name,description,category_id,is_sellable,is_pizza_component,acquisition_type,
      pricing_mode,base_price_amount,base_price_currency,pizza_component_type_id) VALUES
      ('PROD-90003','Cheese','Ingredient','CAT-00001',false,true,'PURCHASED',NULL,NULL,NULL,'type-03'),
      ('PROD-90020','Pizza','Cheese pizza','CAT-00001',true,false,'PRODUCED','COMPONENT_BASED',NULL,NULL,NULL),
      ('PROD-90030','Drink','Drink','CAT-00001',true,false,'PURCHASED','FIXED',2,'EUR',NULL)`);
    await db.query(
      "INSERT INTO product_composition_items VALUES ('PROD-90020','PROD-90003',1)",
    );
    await db.query(
      "INSERT INTO pizza_sizes(id,name) VALUES ('PSIZE-0002','Medium')",
    );
    await db.query(
      "INSERT INTO component_size_configurations(product_id,size_id,price_amount,price_currency,stock_units_consumed) VALUES ('PROD-90003','PSIZE-0002',1,'EUR',120)",
    );
    await db.query(
      "INSERT INTO planning_product_settings VALUES ('PROD-90003','g',NULL),('PROD-90030','unit',2)",
    );
    await db.query(
      `INSERT INTO stock_information(id,stock_code,product_id,available_units) VALUES
      ($1,'STOCK-90003','PROD-90003',400),($2,'STOCK-90030','PROD-90030',4)`,
      [randomUUID(), randomUUID()],
    );
    const authMiddleware = new AuthMiddleware({
      resolveActor: async (token) => ({
        sub: token,
        roles: token === 'staff' ? ['EMPLOYEE'] : ['MANAGER'],
      }),
    });
    const forecastModule = createForecastModule({
      database: db,
      authMiddleware,
    });
    fixtures = await FixtureRegistry.bundled();
    inputs = createPlanningInputModule({
      database: db,
      credentials,
      fixtures,
      demandReader: forecastModule.forecasts,
    });
    const procurementScenarios = createProcurementScenarios({
      backoffice: (...args) => backofficeClient(url)(...args),
      confirmToken: credentials.supplierConfirmToken,
    });
    const app = createApp({
      forecastModule,
      procurementScenarios,
      planningInputModule: inputs,
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    url = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  });
  afterAll(async () => {
    await inputs?.dispose();
    if (server?.listening)
      await new Promise((resolve) => server.close(resolve));
    await db?.close();
  });
  test('current Manager access protects both owners and a preview belongs to its reviewer', async () => {
    for (const path of [
      '/planning/forecasts',
      '/planning/supplier-scenarios',
    ]) {
      expect((await call('GET', path, null, null)).status).toBe(401);
      expect((await call('GET', path, null, 'staff')).status).toBe(403);
    }
    const { body: p } = await preview(offers);
    const path = '/planning/supplier-scenario-previews/' + p.previewId;
    expect((await call('GET', path, null, 'other-manager')).status).toBe(404);
    expect(
      (await call('PUT', path + '/confirmation', null, 'staff')).status,
    ).toBe(403);
  });
  test('concurrent create, conflict and archive preserve the first receipt and original demand', async () => {
    const draft = forecast('Weekend', 2, 4);
    const [a, b] = await Promise.all([
      postForecast(draft),
      postForecast(draft),
    ]);
    expect(a.status).toBe(201);
    expect(a).toEqual(b);
    const { id, version } = a.body;
    expect((await postForecast({ ...draft, name: 'Changed' })).status).toBe(
      409,
    );
    const { creationRequestId, ...fields } = draft;
    expect(creationRequestId).toBeTruthy();
    const path = '/planning/forecasts/' + id;
    const edits = await Promise.all(
      [1, 2].map((n) =>
        call('PUT', path, { ...fields, name: 'Edited ' + n, version }),
      ),
    );
    expect(edits.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await call('DELETE', path + '?version=1')).status).toBe(409);
    expect((await call('DELETE', path + '?version=2')).status).toBe(204);
    expect((await call('GET', path)).status).toBe(404);
    expect(await postForecast(draft)).toEqual(a);
    expect(
      (
        await db.query(
          'SELECT document FROM consumption_forecast_versions WHERE forecast_id=$1 AND version=1',
          [id],
        )
      ).rows[0].document,
    ).toEqual(fields);
  });
  test('export, preview, reconfirmation, invalid documents, changed units and empty scenarios', async () => {
    const exported = await call('GET', '/planning/products/export');
    expect(exported.body.products).toEqual([
      { productId: cheese, name: 'Cheese', stockUnit: 'g' },
      {
        productId: drink,
        name: 'Drink',
        stockUnit: 'unit',
        cataloguePriceEur: '2.00',
      },
    ]);
    const p = await preview(offers);
    expect(p.status).toBe(201);
    expect(p.body.withoutOffers.map((row) => row.productId)).toEqual([cheese]);
    const id = p.body.previewId,
      saved = await confirm(id);
    expect(saved.status).toBe(200);
    expect((await confirm(id)).body.id).toBe(saved.body.id);
    expect(
      (await call('GET', '/planning/supplier-scenario-previews/' + id)).body
        .status,
    ).toBe('CONFIRMED');
    const prev = await call('GET', '/planning/supplier-scenarios');
    for (const mutate of [
      (d) => (d.products[0].productId = 'unknown'),
      (d) => (d.products[0].offers[0].supplierId = 'unknown'),
      (d) => delete d.products[0].offers[0].priceEur,
      (d) => delete d.products[0].offers[0].leadTimeDays,
      (d) => (d.products[0].offers[0].leadTimeDays = 1.5),
      (d) => (d.products[0].offers[0].coveredUnits = 0),
      (d) => (d.products[0].offers[0].dailyLimit = -1),
      (d) => d.products[0].offers.push(quote),
      (d) => d.products.push(d.products[0]),
      (d) => d.suppliers.push({ id: 'A' }),
    ]) {
      const document = JSON.parse(JSON.stringify(offers));
      mutate(document);
      expect((await preview(document)).status).toBe(422);
    }
    const changed = (await preview(offers)).body.previewId;
    await db.query(
      "UPDATE planning_product_settings SET stock_unit='bottle' WHERE product_id=$1",
      [drink],
    );
    try {
      expect((await confirm(changed)).status).toBe(422);
    } finally {
      await db.query(
        "UPDATE planning_product_settings SET stock_unit='unit' WHERE product_id=$1",
        [drink],
      );
    }
    await db.query(
      'UPDATE planning_supplier_previews SET expires_at=now() WHERE id=$1',
      [changed],
    );
    expect((await confirm(changed)).status).toBe(409);
    expect(await call('GET', '/planning/supplier-scenarios')).toEqual(prev);
    expect(
      (
        await confirm(
          (await preview({ suppliers: [], products: [] })).body.previewId,
        )
      ).status,
    ).toBe(200);
    const old = await call(
      'POST',
      '/internal/planning/supplier-offers',
      { ...{ id: saved.body.id, version: '1' }, productIds: [drink] },
      credentials.readToken,
    );
    expect(old.body.offers).toHaveLength(2);
  });
  test('a size deactivated after saving prevents a fresh live input capture', async () => {
    const saved = await postForecast(forecast('Active at creation', 1, 2));
    const selection = {
      executionId: randomUUID(),
      scenarioId: 'demo',
      calculation: 'BOM',
      mode: 'current',
      demand: { type: 'forecast', ...saved.body },
      catalogue: { type: 'current' },
      stock: { type: 'current' },
    };
    await db.query('UPDATE pizza_sizes SET active=false WHERE id=$1', [size]);
    try {
      const result = await call(
        'POST',
        '/internal/planning/read-views',
        selection,
        credentials.readToken,
      );
      expect(result).toMatchObject({
        status: 422,
        body: { error: { code: 'INCOMPATIBLE_SIZE' } },
      });
    } finally {
      await db.query('UPDATE pizza_sizes SET active=true WHERE id=$1', [size]);
    }
  });
  const realProlog = process.env.SWIPL ? test : test.skip;
  realProlog(
    'two saved two-day forecasts reach Prolog with confirmed offers and preserve stock',
    async () => {
      const p = await preview(offers);
      const supplier = await confirm(p.body.previewId);
      const before = async () =>
        (
          await db.query(
            'SELECT product_id,available_units FROM stock_information ORDER BY product_id',
          )
        ).rows;
      const original = await before();
      const savedStock = { type: 'saved', id: 'daily-sales', version: '1' };
      const scenarioBefore = JSON.stringify(
        fixtures.get(savedStock).openingStock,
      );
      const cheeseNeeds = [];
      for (const draft of [
        forecast('Weekend A', 2, 3),
        forecast('Weekend B', 4, 1),
      ]) {
        const saved = await postForecast(draft);
        const selection = {
          executionId: randomUUID(),
          scenarioId: 'demo',
          calculation: 'REQUIREMENTS_PLANNING',
          mode: 'current',
          referenceDate: '2026-11-20',
          demand: { type: 'forecast', ...saved.body },
          catalogue: { type: 'current' },
          stock: { type: 'current' },
          receipts: { type: 'saved', id: 'daily-sales', version: '1' },
          supplierScenario: {
            type: 'confirmed',
            id: supplier.body.id,
            version: '1',
          },
        };
        if (cheeseNeeds.length) selection.stock = savedStock;
        const { attemptNo } = await inputs.records.claim(selection);
        const result = await new Promise((resolve, reject) => {
          const child = execFile(
            process.env.SWIPL,
            [
              '-q',
              '-s',
              'ai/demo_inputs.pl',
              '-g',
              'demo_inputs',
              '-t',
              'halt',
            ],
            {
              cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
              timeout: 12000,
              env: {
                ...process.env,
                LAPRIZZA_INPUT_API_URL: url,
                LAPRIZZA_INPUT_READ_TOKEN: credentials.readToken,
                LAPRIZZA_INPUT_RECORDS_TOKEN: credentials.recordsToken,
              },
            },
            (error, stdout) =>
              error ? reject(error) : resolve(JSON.parse(stdout)),
          );
          child.stdin.end(JSON.stringify({ ...selection, attemptNo }));
        });
        expect(result.error).toBeUndefined();
        expect(result.requirementsPlan.forecast).toEqual(saved.body);
        const rows = result.requirementsPlan.days;
        expect(
          rows.find((r) => r.productId === drink && r.requiredUnits > 0)
            .requiredUnits,
        ).toBe(12);
        cheeseNeeds.push(
          rows
            .filter((r) => r.productId === cheese)
            .map((r) => r.requiredUnits),
        );
        expect(result.provenance).toContainEqual(
          expect.objectContaining({
            dataset: 'offers',
            source: supplier.body.id,
            simulated: true,
          }),
        );
        const first = await inputs.records.get(selection.executionId);
        expect(
          first.snapshot.document.openingStock.find(
            (r) => r.productId === drink,
          ).availableUnits,
        ).toBe(4);
        expect(await before()).toEqual(original);
        expect(JSON.stringify(fixtures.get(savedStock).openingStock)).toBe(
          scenarioBefore,
        );
        expect(result.requirementsPlan.warnings).toContainEqual(
          expect.objectContaining({
            code: 'UNKNOWN_CAPACITY',
            productId: drink,
            supplierId: 'A',
          }),
        );
      }
      expect(cheeseNeeds).toEqual([
        [240, 360],
        [480, 120],
      ]);
    },
    30000,
  );
});
