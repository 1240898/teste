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

export const componentTypeSchemas = {
  ComponentTypeData: object({
    name: { type: 'string', minLength: 1 },
    assemblyOrder: { type: 'integer', minimum: 1 },
    minQuantity: { type: 'integer', minimum: 0 },
    maxQuantity: { type: 'integer', minimum: 0, nullable: true },
  }),
  ComponentTypeUpdate: {
    ...object(
      {
        name: { type: 'string', minLength: 1 },
        assemblyOrder: { type: 'integer', minimum: 1 },
        minQuantity: { type: 'integer', minimum: 0 },
        maxQuantity: { type: 'integer', minimum: 0, nullable: true },
      },
      [],
    ),
    minProperties: 1,
  },
  ComponentTypeResponse: object({
    id: { type: 'string' },
    name: { type: 'string' },
    assemblyOrder: { type: 'integer', minimum: 1 },
    minQuantity: { type: 'integer', minimum: 0 },
    maxQuantity: { type: 'integer', minimum: 0, nullable: true },
  }),
};

const security = [{ bearerAuth: [] }, { accessToken: [] }];
const response = (description, schema) => ({
  description,
  ...(schema ? { content: json(schema) } : {}),
});
const commonErrors = {
  400: error('Invalid request'),
  401: error('Missing or invalid token'),
  403: error('Manager role required'),
  500: error('Unexpected internal error'),
};
const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};
const searchParameters = [
  { name: 'id', in: 'query', schema: { type: 'string' } },
  { name: 'name', in: 'query', schema: { type: 'string' } },
];

export const componentTypePaths = {
  '/pizza-component-types': {
    get: {
      operationId: 'searchPizzaComponentTypes',
      summary: 'Search or list Pizza Component Types',
      description:
        'Name matching is exact and case-insensitive. If both id and name are supplied, a result matching either is returned. If neither is supplied, all types are returned.',
      tags: ['Pizza Component Types'],
      security,
      parameters: searchParameters,
      responses: {
        200: response('Matching types (possibly empty)', {
          type: 'array',
          items: ref('ComponentTypeResponse'),
        }),
        ...commonErrors,
      },
    },
    post: {
      operationId: 'createPizzaComponentType',
      summary: 'Create a Pizza Component Type',
      tags: ['Pizza Component Types'],
      security,
      requestBody: {
        required: true,
        content: json(ref('ComponentTypeData')),
      },
      responses: {
        201: {
          ...response('Type created', ref('ComponentTypeResponse')),
          headers: {
            Location: {
              description: 'Created type resource',
              schema: { type: 'string' },
            },
          },
        },
        ...commonErrors,
        409: error('Assembly order or name already exists; unsafe impact'),
      },
    },
  },
  '/pizza-component-types/{id}': {
    get: {
      operationId: 'getPizzaComponentType',
      summary: 'Consult a Pizza Component Type',
      tags: ['Pizza Component Types'],
      security,
      parameters: [idParameter],
      responses: {
        200: response('Type found', ref('ComponentTypeResponse')),
        ...commonErrors,
        404: error('Type not found'),
      },
    },
    patch: {
      operationId: 'updatePizzaComponentType',
      summary: 'Partially update a Pizza Component Type',
      description:
        'Omitted properties retain their values. Set maxQuantity to null for an unbounded maximum. The type ID remains unchanged.',
      tags: ['Pizza Component Types'],
      security,
      parameters: [idParameter],
      requestBody: {
        required: true,
        content: json(ref('ComponentTypeUpdate')),
      },
      responses: {
        200: response('Type updated', ref('ComponentTypeResponse')),
        ...commonErrors,
        404: error('Type not found'),
        409: error('Order or name already exists; unsafe impact'),
      },
    },
    delete: {
      operationId: 'removePizzaComponentType',
      summary: 'Safely remove a Pizza Component Type',
      tags: ['Pizza Component Types'],
      security,
      parameters: [idParameter],
      responses: {
        204: response('Type removed'),
        ...commonErrors,
        404: error('Type not found'),
        409: error('Referenced type or safety could not be established'),
      },
    },
  },
};
