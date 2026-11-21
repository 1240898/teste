const json = (schema) => ({ 'application/json': { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string', minLength: 1 };
const ids = { type: 'array', uniqueItems: true, maxItems: 500, items: string };
const savedSelector = object({ type: { enum: ['saved'] }, id: string, version: string });
const sourceSelector = { oneOf: [savedSelector, object({ type: { enum: ['current'] } })] };
const versionedId = object({ id: string, version: string });
const supplierSelector = object({ id: string, version: string,
  type: { enum: ['confirmed', 'fixture'], default: 'confirmed' } }, ['id', 'version']);
const demandSelector = { oneOf: [
  object({ type: { enum: ['fixture', 'forecast'] }, id: string, version: string }),
  object({ type: { enum: ['order'] }, id: string, version: string }, ['type', 'id']),
] };
const read = [{ planningServiceRead: [] }], write = [{ planningRecordsWrite: [] }];
const pathId = [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }];
const responses = { 200: { description: 'Selected records from one coherent view or an immutable retained input snapshot.', content: json({ type: 'object' }) },
  ...Object.fromEntries([400, 401, 403, 404, 409, 422, 503].map((status) => [status, {
    description: 'Planning input diagnostic. 409 INPUTS_NOT_SEALED includes execution context; all other failures stop capture. 422 FIXTURE_PRODUCT_CONFLICT rejects preparation products colliding with the selected catalogue.',
    content: json(ref('PlanningInputError')) }])) };
const operation = (id, summary, security, schema, parameters) => ({ operationId: id, summary,
  tags: ['Planning inputs (internal)'], security, ...(parameters && { parameters }),
  ...(schema && { requestBody: { required: true, content: json(schema) } }), responses });
const base = '/internal/planning';
const rawGroups = { products: 'PlanningSourceProduct', sizes: 'PlanningSourceSize',
  'pizza-configurations': 'PlanningSourcePizza', 'component-configurations': 'PlanningSourceConsumption',
  recipes: 'PlanningSourceRecipe', stock: 'PlanningSourceStock', 'incoming-deliveries': 'PlanningSourceReceipt' };
const withSuccess = (op, schema) => ({ ...op, responses: { ...op.responses,
  200: { description: 'Selected source records; Prolog validates the business relationships.', content: json(schema) } } });

export const planningInputPaths = {
  [`${base}/input-runs`]: { post: operation('claimPlanningInputRun',
    'Register or retry an input acquisition lease. Internal records adapter only; does not create operational orders or AI05 results.', write, ref('PlanningInputSelection')) },
  [`${base}/input-runs/{id}/inputs`]: {
    get: operation('readPlanningInputSnapshot', 'Read retained inputs; 409 INPUTS_NOT_SEALED permits a fresh current capture.', read, null, pathId),
    put: operation('sealPlanningInputSnapshot', 'Seal the first valid document for a current unexpired attempt; subsequent writes return the winner.', write,
      object({ attemptNo: { type: 'integer', minimum: 1 }, document: { type: 'object', description: 'Validated raw source records and selection, assembled by Prolog.' } }), pathId),
  },
  [`${base}/read-views`]: { post: withSuccess(operation('openPlanningReadView',
    'Open a 60-second coherent view. Returns demand selectors/lines and provenance, not a complete business dataset or a Prolog KB.', read, ref('PlanningInputSelection')), ref('PlanningReadView')) },
  ...Object.fromEntries(Object.keys(rawGroups).map((group) =>
    [`${base}/read-views/{id}/${group}`, { post: withSuccess(operation(`readPlanning_${group.replaceAll('-', '_')}`,
      `Read selected ${group}. Returns {viewId, revision, items}; all reads use the same snapshot.`, read, ref('PlanningReadIds'), pathId),
      object({ viewId: { type: 'string', format: 'uuid' }, revision: string,
        items: { type: 'array', items: ref(rawGroups[group]) } })) }])),
  [`${base}/read-views/{id}`]: { delete: { ...operation('closePlanningReadView', 'Release a transient read-only view.', read, null, pathId),
    responses: { 204: { description: 'View released (also succeeds when already closed).' }, 400: responses[400], 401: responses[401], 403: responses[403], 503: responses[503] } } },
  [`${base}/supplier-offers`]: { post: operation('readPlanningSupplierOffers',
    'Read the selected immutable WEB07-confirmed version. Use type fixture to select an explicit simulation fixture.', read,
    object({ ...supplierSelector.properties, productIds: ids }, ['id', 'version', 'productIds'])) },
  '/internal/planning-records/supplier-previews': {
    post: operation('storeSupplierPreview', 'Store the reviewed document and missing offers for the authenticated reviewer.',
      [{ planningSupplierConfirm: [] }], object({ actor: string, document: ref('PlanningSupplierConfirmation'),
        withoutOffers: { type: 'array', items: { type: 'object' } } })),
  },
  '/internal/planning-records/supplier-previews/{id}': {
    get: operation('getSupplierPreviewRecord', 'Read an actor-bound preview and its confirmation state.',
      [{ planningSupplierConfirm: [] }], null, [...pathId, { name: 'actor', in: 'query', required: true, schema: string }]),
  },
  '/internal/planning-records/supplier-previews/confirmed': {
    get: operation('listSupplierVersionRecords', 'Read confirmed version identifiers for the Manager selector.',
      [{ planningSupplierConfirm: [] }]),
  },
  '/internal/planning-records/supplier-scenarios/{scenarioId}/versions/{version}': {
    put: operation('confirmPlanningSupplierVersion', 'Store an explicitly confirmed WEB07 supplier version. Existing versions are immutable.',
      [{ planningSupplierConfirm: [] }], ref('PlanningSupplierConfirmation'), ['scenarioId', 'version'].map((name) =>
        ({ name, in: 'path', required: true, schema: string })).concat([{ name: 'previewActor', in: 'query',
          description: 'Bind a WEB07 confirmation to the reviewed document, actor, expiry and current product references.', schema: string }])),
  },
};

const selectionVariants = ['BOM', 'REQUIREMENTS_PLANNING'].flatMap((calculation) =>
  ['current', 'historicalReplay'].map((mode) => {
    const required = ['executionId', 'scenarioId', 'calculation', 'mode', 'demand', 'catalogue', 'stock'];
    if (calculation === 'REQUIREMENTS_PLANNING') required.push('supplierScenario', 'referenceDate');
    if (mode === 'historicalReplay') required.push('replayedFrom');
    return object({ executionId: { type: 'string', format: 'uuid' }, scenarioId: string,
      calculation: { enum: [calculation] }, mode: { enum: [mode] }, demand: demandSelector,
      catalogue: sourceSelector, stock: sourceSelector, preparationFixture: versionedId,
      ...(calculation === 'REQUIREMENTS_PLANNING' && { supplierScenario: supplierSelector, referenceDate: { type: 'string', format: 'date' },
        receipts: { ...sourceSelector, description: 'Optional receipt source; follows the stock selector when omitted. An explicit empty list means no pending deliveries.' } }),
      ...(mode === 'historicalReplay' && { replayedFrom: { type: 'string', format: 'uuid' } }),
    }, required);
  }));
const quantity = { type: 'integer', minimum: 0, maximum: 9007199254740991 };
const component = object({ productId: string, quantity: { ...quantity, minimum: 1 } });
const forecast = object({ id: string, version: string, startDate: { type: 'string', format: 'date' }, endDate: { type: 'string', format: 'date' } });

export const planningInputSchemas = {
  PlanningInputSelection: { oneOf: selectionVariants,
    description: 'Fresh operational order/forecast demand requires current catalogue eligibility; saved stock alone is not a historical exception.',
    not: { type: 'object', required: ['mode', 'demand', 'catalogue'], properties: {
      mode: { enum: ['current'] }, demand: { properties: { type: { enum: ['order', 'forecast'] } } },
      catalogue: { properties: { type: { enum: ['saved'] } } },
    } },
  },
  PlanningReadIds: object({ productIds: ids, sizeIds: { ...ids, maxItems: 50, default: [] } }, ['productIds']),
  PlanningInputProvenance: object({ dataset: string, source: string, version: string,
    retrievedAt: { type: 'string', format: 'date-time' }, simulated: { type: 'boolean' } }, ['dataset', 'source', 'simulated']),
  PlanningSourceProduct: object({ productId: string, isActive: { type: 'boolean' }, isSellable: { type: 'boolean' },
    isPizza: { type: 'boolean' }, isPizzaComponent: { type: 'boolean' }, kind: { enum: ['terminal', 'aggregate'] },
    acquisitionType: { type: 'string', nullable: true }, tracked: { type: 'boolean' }, stockUnit: { ...string, nullable: true },
    stockUnitsPerSale: { ...quantity, nullable: true }, planningOrigin: { enum: ['fixture'] } },
  ['productId', 'isActive', 'isSellable', 'isPizza', 'tracked']),
  PlanningSourceSize: object({ sizeId: string, isActive: { type: 'boolean' } }),
  PlanningSourcePizza: object({ productId: string, components: { type: 'array', minItems: 1, items: component } }),
  PlanningSourceConsumption: object({ productId: string, sizeId: string, stockUnitsConsumed: { ...quantity, nullable: true } }),
  PlanningSourceRecipe: object({ productId: string, yieldUnits: { ...quantity, minimum: 1 }, ingredients: {
    type: 'array', minItems: 1, items: object({ productId: string, unitsPerBatch: { ...quantity, minimum: 1 } }) } }),
  PlanningSourceStock: object({ productId: string, availableUnits: quantity, stockUnit: string }),
  PlanningSupplierConfirmation: object({
    suppliers: { type: 'array', items: object({ id: string, name: string }, ['id']) },
    products: { type: 'array', items: object({ productId: string, stockUnit: string,
      offers: { type: 'array', items: object({ supplierId: string, priceEur: { ...string, pattern: '^\\d+(?:\\.\\d{1,2})?$' },
        coveredUnits: { ...quantity, minimum: 1 }, leadTimeDays: quantity, dailyLimit: quantity },
      ['supplierId', 'priceEur', 'coveredUnits', 'leadTimeDays']) } }) },
  }),
  PlanningSourceReceipt: object({ receiptId: string, productId: string, remainingUnits: { ...quantity, minimum: 1 },
    stockUnit: string, expectedDeliveryDate: { type: 'string', format: 'date' } }),
  PlanningSourceDemand: object({ type: { enum: ['pizza', 'directSale'] }, productId: { ...string, nullable: true },
    sizeId: string, quantity, date: { type: 'string', format: 'date' },
    selectedComponents: { type: 'array', minItems: 1, items: component }, selectedComponentIds: ids }, ['type', 'quantity']),
  PlanningReadView: object({ viewId: { type: 'string', format: 'uuid' }, revision: string,
    retrievedAt: { type: 'string', format: 'date-time' }, cataloguePolicy: { enum: ['explicit-fixture', 'pizza-components-terminal'] },
    demandLines: { type: 'array', items: ref('PlanningSourceDemand') }, forecast: { ...forecast, nullable: true },
    provenance: { type: 'array', items: ref('PlanningInputProvenance') } }),
  PlanningInputError: object({ error: object({ code: string, status: { type: 'integer' }, message: string,
    field: string, reference: string }, ['code', 'status', 'message']), execution: { type: 'object' } }, ['error']),
};
export const planningInputSecurity = {
  planningSupplierConfirm: { type: 'http', scheme: 'bearer', description: 'Dedicated WEB07 service credential for explicitly confirmed supplier versions.' },
  planningServiceRead: { type: 'http', scheme: 'bearer', description: 'Opaque server-side planning read credential, separate from Manager sessions.' },
  planningRecordsWrite: { type: 'http', scheme: 'bearer', description: 'Distinct internal input-records credential; cannot read operational data or change stock/orders.' },
};
