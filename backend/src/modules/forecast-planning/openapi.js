const text = { type: 'string' };
const date = { type: 'string', format: 'date' };
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
});
const array = (items) => ({ type: 'array', items });
const json = (schema) => ({ 'application/json': { schema } });
const ref = (name) => ({ $ref: '#/components/schemas/' + name });
const versioned = object({ id: text, version: text });
const entry = object(
  {
    date,
    productId: text,
    sizeId: text,
    quantity: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
  },
  ['date', 'productId', 'quantity'],
);
const draft = {
  name: text,
  startDate: date,
  endDate: date,
  entries: array(entry),
};
const product = object(
  { productId: text, name: text, stockUnit: text, cataloguePriceEur: text },
  ['productId', 'name', 'stockUnit'],
);
const preview = object(
  {
    previewId: text,
    expiresAt: { type: 'string', format: 'date-time' },
    document: ref('PlanningSupplierConfirmation'),
    withoutOffers: array(product),
    simulated: { type: 'boolean' },
    status: { enum: ['REVIEW', 'CONFIRMED'] },
    scenario: versioned,
  },
  [
    'previewId',
    'expiresAt',
    'document',
    'withoutOffers',
    'simulated',
    'status',
  ],
);
const diagnostic = object({
  error: object(
    {
      status: { type: 'integer' },
      code: text,
      message: text,
      details: array(
        object(
          { path: text, code: text, message: text, params: { type: 'object' } },
          ['path', 'code', 'message'],
        ),
      ),
    },
    ['status', 'message'],
  ),
});
const parameter = (name, location = 'path') => ({
  name,
  in: location,
  required: true,
  schema: text,
});
const id = [parameter('id')];
function operation(
  operationId,
  summary,
  response,
  { body, status = 200, parameters } = {},
) {
  return {
    operationId,
    summary,
    tags: ['Manager planning'],
    security: [{ bearerAuth: [] }],
    ...(parameters && { parameters }),
    ...(body && { requestBody: { required: true, content: json(body) } }),
    responses: {
      [status]: {
        description: summary,
        ...(response && { content: json(response) }),
      },
      ...Object.fromEntries(
        [400, 401, 403, 404, 409, 422, 503].map((code) => [
          code,
          {
            description: 'Request rejected or planning service unavailable.',
            content: json(diagnostic),
          },
        ]),
      ),
    },
  };
}
export const managerPlanningPaths = {
  '/internal/planning-access': {
    get: operation(
      'checkPlanningManager',
      'Verify current planning access',
      object({ actorId: text }),
    ),
  },
  '/planning/forecast-options': {
    get: operation(
      'forecastOptions',
      'Active sellable products and compatible sizes',
      object({
        products: array(
          object({
            productId: text,
            name: text,
            isPizza: { type: 'boolean' },
            sizes: array(object({ id: text, name: text })),
          }),
        ),
      }),
    ),
  },
  '/planning/forecasts': {
    get: operation(
      'listForecasts',
      'List saved forecasts',
      object({ items: array(object({ ...versioned.properties, name: text })) }),
    ),
    post: operation(
      'createForecast',
      'Idempotently create a forecast',
      versioned,
      {
        status: 201,
        body: object({
          ...draft,
          creationRequestId: { type: 'string', format: 'uuid' },
        }),
      },
    ),
  },
  '/planning/forecasts/{id}': {
    get: operation(
      'readForecast',
      'Read current forecast',
      object({ ...draft, ...versioned.properties }),
      { parameters: id },
    ),
    put: operation('editForecast', 'Save a new version', versioned, {
      parameters: id,
      body: object({ ...draft, version: text }),
    }),
    delete: operation('archiveForecast', 'Archive this forecast', null, {
      status: 204,
      parameters: [...id, parameter('version', 'query')],
    }),
  },
  '/planning/products/export': {
    get: operation(
      'exportPlanningProducts',
      'Export eligible products with stock units',
      object({ products: array(product) }),
    ),
  },
  '/planning/supplier-scenario-previews': {
    post: operation(
      'previewSupplierScenario',
      'Validate and preview simulated offers',
      preview,
      { status: 201, body: ref('PlanningSupplierConfirmation') },
    ),
  },
  '/planning/supplier-scenario-previews/{id}': {
    get: operation(
      'readSupplierPreview',
      'Recover a reviewed preview',
      preview,
      { parameters: id },
    ),
  },
  '/planning/supplier-scenario-previews/{id}/confirmation': {
    put: operation(
      'confirmSupplierPreview',
      'Confirm the reviewed supplier version',
      versioned,
      { parameters: id },
    ),
  },
  '/planning/supplier-scenarios': {
    get: operation(
      'listSupplierScenarios',
      'List confirmed supplier versions',
      object({ items: array(versioned) }),
    ),
  },
};
