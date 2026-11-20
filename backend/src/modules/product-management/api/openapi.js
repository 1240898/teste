const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});

const productIdSchema = {
  type: 'string',
  pattern: '^PROD-\\d{5,}$',
  example: 'PROD-00123',
};
const editable = {
  name: {
    type: 'string',
    minLength: 1,
    maxLength: 100,
    description: 'Trimmed. Names are NOT unique.',
    example: 'Mozzarella Cheese',
  },
  description: {
    type: 'string',
    minLength: 1,
    maxLength: 500,
    example: 'Shredded fresh mozzarella cheese for pizza topping',
  },
  categoryId: { type: 'string', pattern: '^CAT-\\d{5,}$', example: 'CAT-00001' },
  isSellable: { type: 'boolean', example: false },
  isPizzaComponent: { type: 'boolean', example: true },
  acquisitionType: {
    type: 'string',
    enum: ['PRODUCED', 'PURCHASED'],
    example: 'PRODUCED',
  },
  compositionItems: {
    type: 'array',
    description:
      'Direct child products and their positive quantities. Repeated child product IDs are combined by summing their quantities; cyclic compositions are rejected.',
    items: object({
      productId: productIdSchema,
      quantity: { type: 'integer', minimum: 1, maximum: 2147483647 },
    }),
  },
  pizzaComponentTypeId: {
    type: 'string',
    nullable: true,
    example: 'type-03',
    description: 'Required if and only if isPizzaComponent is true.',
  },
  allergenIds: {
    type: 'array',
    uniqueItems: true,
    maxItems: 14,
    items: { type: 'integer', minimum: 1, maximum: 14 },
    example: [7],
  },
  pricingMode: {
    type: 'string',
    enum: ['FIXED', 'COMPONENT_BASED', null],
    nullable: true,
    example: null,
    description:
      'null for non-sellable products; FIXED (requires basePrice) or COMPONENT_BASED (predefined pizzas, no basePrice) for sellable ones.',
  },
  basePrice: {
    type: 'number',
    nullable: true,
    minimum: 0,
    multipleOf: 0.01,
    example: null,
    description: 'EUR, at most 2 decimal places. Only for FIXED pricing.',
  },
};

export const productSchemas = {
  ProductRequest: object(
    editable,
  ),
  ProductUpdateRequest: object({
    ...editable,
    expectedUpdatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'updatedAt value returned when the product was loaded for editing.',
      example: '2026-11-17T09:30:00.000Z',
    },
  }),
  ProductResponse: object({
    id: productIdSchema,
    ...editable,
    isActive: { type: 'boolean', example: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  }),
  PublicProductResponse: object({
    id: productIdSchema,
    name: editable.name,
    description: editable.description,
    categoryId: editable.categoryId,
    allergenIds: editable.allergenIds,
    pricingMode: editable.pricingMode,
    basePrice: editable.basePrice,
  }),
};

const descriptions = {
  400: 'Invalid body, filter or product id; invalid acquisition, composition, component-type or pricing combination',
  401: 'Missing or invalid token',
  403: 'Role not allowed',
  404: 'Product, category, pizza component type or allergen not found',
  409: 'The change would invalidate existing references or create a product composition cycle',
  412: 'The product changed after it was loaded; reload and review before saving',
  413: 'Request body too large',
  500: 'Internal server error; implementation details are withheld',
};

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: productIdSchema,
};
const query = (name, schema, description) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema,
});
const flag = (name) =>
  query(name, { type: 'string', enum: ['true', 'false'] }, `Filter by ${name}`);

function operation(
  operationId,
  summary,
  {
    input,
    status = 200,
    output,
    errors = [],
    id = false,
    parameters = [],
    publicAccess = false,
  } = {},
) {
  const allParameters = [...(id ? [idParameter] : []), ...parameters];
  return {
    operationId,
    summary,
    tags: ['Products'],
    security: publicAccess
      ? []
      : [{ bearerAuth: [] }, { accessToken: [] }],
    ...(input
      ? { requestBody: { required: true, content: json(ref(input)) } }
      : {}),
    ...(allParameters.length ? { parameters: allParameters } : {}),
    responses: {
      [status]: {
        description:
          status === 201
            ? 'Product created'
            : status === 204
              ? 'Product deactivated'
              : 'Success',
        ...(output ? { content: json(output) } : {}),
        ...(status === 201
          ? {
              headers: {
                Location: {
                  description: 'Created product resource',
                  schema: { type: 'string' },
                },
              },
            }
          : {}),
      },
      ...Object.fromEntries(
        [...errors, 401, 403, 500].map((code) => [
          code,
          {
            description: descriptions[code],
            content: json(ref('ErrorResponse')),
          },
        ]),
      ),
    },
  };
}

export const productPaths = {
  '/products': {
    get: operation('listProducts', 'Public product information (all roles)', {
      publicAccess: true,
      output: { type: 'array', items: ref('PublicProductResponse') },
      parameters: [
        query(
          'name',
          { type: 'string', maxLength: 100 },
          'Case-insensitive partial match on the name',
        ),
        query('categoryId', { type: 'string', pattern: '^CAT-\\d{5,}$' }, 'Category'),
        flag('isSellable'),
        flag('isPizzaComponent'),
        flag('isActive'),
        query('acquisitionType', {
          type: 'string',
          enum: ['PRODUCED', 'PURCHASED'],
        }, 'Acquisition type'),
        query('pizzaComponentTypeId', { type: 'string' }, 'Pizza component type'),
        query(
          'excludeAllergenIds',
          { type: 'string', pattern: '^\\d{1,2}(,\\d{1,2})*$', example: '1,7' },
          'Comma-separated allergen ids; products containing ANY of them are omitted',
        ),
      ],
      errors: [400],
    }),
    post: operation('createProduct', 'Create a product (Manager)', {
      input: 'ProductRequest',
      status: 201,
      output: ref('ProductResponse'),
      errors: [400, 404, 413],
    }),
  },
  '/products/{id}': {
    get: operation('getProduct', 'Get public product information (all roles)', {
      publicAccess: true,
      id: true,
      output: ref('PublicProductResponse'),
      errors: [400, 404],
    }),
    put: operation(
      'updateProduct',
      'Replace the editable state of a product (Manager)',
      {
        id: true,
        input: 'ProductUpdateRequest',
        output: ref('ProductResponse'),
        errors: [400, 404, 409, 412, 413],
      },
    ),
    delete: operation(
      'deactivateProduct',
      'Soft-deactivate a product (Manager); references and stock are kept',
      { id: true, status: 204, errors: [400, 404] },
    ),
  },
  '/products/{id}/activate': {
    patch: operation('activateProduct', 'Reactivate a product (Manager)', {
      id: true,
      output: ref('ProductResponse'),
      errors: [400, 404],
    }),
  },
};
