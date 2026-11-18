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
  content: json(schema),
});
const commonErrors = {
  400: error('Invalid request'),
  401: error('Missing or invalid token'),
  403: error('Manager role required'),
  500: error('Unexpected internal error'),
};
const pizzaIdParameter = {
  name: 'productId',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^PROD-[0-9]{5,}$' },
};

export const predefinedPizzaSchemas = {
  CreatePredefinedPizza: object({
    productId: { type: 'string', pattern: '^PROD-[0-9]{5,}$' },
    componentIds: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { type: 'string', pattern: '^PROD-[0-9]{5,}$' },
    },
  }),
  ReplacePizzaConfiguration: object({
    componentIds: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { type: 'string', pattern: '^PROD-[0-9]{5,}$' },
    },
  }),
  PredefinedPizzaResponse: object({
    id: { type: 'string', pattern: '^PROD-[0-9]{5,}$' },
    componentIds: {
      type: 'array',
      items: { type: 'string', pattern: '^PROD-[0-9]{5,}$' },
    },
  }),
};

export const predefinedPizzaPaths = {
  '/predefined-pizzas': {
    post: {
      operationId: 'createPredefinedPizza',
      summary: 'Create a predefined pizza',
      tags: ['Predefined Pizzas'],
      security,
      requestBody: {
        required: true,
        content: json(ref('CreatePredefinedPizza')),
      },
      responses: {
        201: {
          ...response(
            'Predefined Pizza created',
            ref('PredefinedPizzaResponse'),
          ),
          headers: { Location: { schema: { type: 'string' } } },
        },
        ...commonErrors,
        404: error('Representative Product or component not found'),
        409: error('Configuration is invalid or identifier is already used'),
      },
    },
    get: {
      operationId: 'listPredefinedPizzas',
      summary: 'List predefined pizzas for Manager management',
      tags: ['Predefined Pizzas'],
      security,
      responses: {
        200: response('Management list, possibly empty', {
          type: 'array',
          items: ref('PredefinedPizzaResponse'),
        }),
        ...commonErrors,
      },
    },
  },
  '/predefined-pizzas/{productId}': {
    get: {
      operationId: 'getPredefinedPizza',
      summary: 'Consult a predefined pizza default configuration',
      tags: ['Predefined Pizzas'],
      security,
      parameters: [pizzaIdParameter],
      responses: {
        200: response('Predefined Pizza found', ref('PredefinedPizzaResponse')),
        ...commonErrors,
        404: error('Predefined Pizza not found'),
      },
    },
  },
  '/predefined-pizzas/{productId}/default-configuration': {
    put: {
      operationId: 'replaceDefaultPizzaConfiguration',
      summary: 'Replace the default component set',
      tags: ['Predefined Pizzas'],
      security,
      parameters: [pizzaIdParameter],
      requestBody: {
        required: true,
        content: json(ref('ReplacePizzaConfiguration')),
      },
      responses: {
        200: response('Configuration replaced', ref('PredefinedPizzaResponse')),
        ...commonErrors,
        404: error('Predefined Pizza or component not found'),
        409: error('Configuration is invalid'),
      },
    },
  },
};
