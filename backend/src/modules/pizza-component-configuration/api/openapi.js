const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});
const error = (description) => ({
  description,
  content: json(ref('ErrorResponse')),
});
const security = [{ bearerAuth: [] }, { accessToken: [] }];
const response = (description, schema) => ({
  description,
  ...(schema ? { content: json(schema) } : {}),
});
const commonErrors = {
  400: error('Invalid request or business value'),
  401: error('Missing or invalid token'),
  403: error('Manager role required'),
  404: error('Product, pizza size, or configuration not found'),
  409: error('Duplicate pair or unsafe configuration change'),
  500: error('Unexpected internal error'),
};
const productIdParameter = {
  name: 'productId',
  in: 'path',
  required: true,
  schema: { type: 'string', minLength: 1 },
};
const sizeIdParameter = {
  name: 'sizeId',
  in: 'path',
  required: true,
  schema: { type: 'string', minLength: 1 },
};

const amount = {
  type: 'string',
  pattern: '^\\d+(?:\\.\\d{1,2})?$',
  example: '2.50',
};
const currency = { type: 'string', enum: ['EUR'] };
const stockUnitsConsumed = {
  type: 'integer',
  minimum: 0,
  nullable: true,
};

export const componentConfigurationSchemas = {
  ComponentConfigurationData: object({
    amount,
    currency,
    stockUnitsConsumed,
  }),
  ComponentConfigurationUpdate: {
    ...object(
      {
        amount,
        currency,
        stockUnitsConsumed,
      },
      [],
    ),
    minProperties: 1,
  },
  ComponentConfigurationResponse: object({
    productId: { type: 'string' },
    sizeId: { type: 'string' },
    amount,
    currency,
    stockUnitsConsumed,
  }),
};

export const componentConfigurationPaths = {
  '/products/{productId}/component-configurations/{sizeId}': {
    post: {
      operationId: 'createComponentSizeConfiguration',
      summary: 'Configure a product for a pizza size',
      tags: ['Pizza Component Configurations'],
      security,
      parameters: [productIdParameter, sizeIdParameter],
      requestBody: {
        required: true,
        content: json(ref('ComponentConfigurationData')),
      },
      responses: {
        201: {
          ...response(
            'Configuration created',
            ref('ComponentConfigurationResponse'),
          ),
          headers: {
            Location: {
              description: 'Created component configuration resource',
              schema: { type: 'string' },
            },
          },
        },
        ...commonErrors,
      },
    },
    patch: {
      operationId: 'updateComponentSizeConfiguration',
      summary: 'Partially update a component-size configuration',
      description:
        'Only supplied properties change. Product and pizza-size references remain unchanged; amount responses are canonicalized to two decimals.',
      tags: ['Pizza Component Configurations'],
      security,
      parameters: [productIdParameter, sizeIdParameter],
      requestBody: {
        required: true,
        content: json(ref('ComponentConfigurationUpdate')),
      },
      responses: {
        200: response(
          'Configuration updated',
          ref('ComponentConfigurationResponse'),
        ),
        ...commonErrors,
      },
    },
  },
  '/products/{productId}/component-configurations': {
    get: {
      operationId: 'consultComponentSizeConfigurations',
      summary: 'Consult a product component configuration',
      description:
        'Returns all configured pizza sizes for the product, or an empty array when the product has no configurations. Active-state filtering is not applied here.',
      tags: ['Pizza Component Configurations'],
      security,
      parameters: [productIdParameter],
      responses: {
        200: response('Configurations, possibly empty', {
          type: 'array',
          items: ref('ComponentConfigurationResponse'),
        }),
        ...commonErrors,
      },
    },
  },
};
