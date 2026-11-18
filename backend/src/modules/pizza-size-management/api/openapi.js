const error = {
  description: 'Error response',
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
  },
};
const secured = { security: [{ bearerAuth: [] }] };
const id = {
  name: 'id',
  in: 'path',
  required: true,
  schema: {
    type: 'string',
    pattern: '^PSIZE-[0-9]{4,}$',
    example: 'PSIZE-0001',
  },
};

export const pizzaSizeSchemas = {
  PizzaSizeInput: {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 50 },
    },
  },
  PizzaSizeUpdate: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 50 },
      active: { type: 'boolean' },
    },
  },
  PizzaSize: {
    type: 'object',
    required: ['id', 'name', 'active'],
    properties: {
      id: {
        type: 'string',
        pattern: '^PSIZE-[0-9]{4,}$',
        example: 'PSIZE-0001',
      },
      name: { type: 'string', example: 'Small' },
      active: { type: 'boolean' },
    },
  },
};

export const pizzaSizePaths = {
  '/pizza-sizes': {
    post: {
      ...secured,
      tags: ['Pizza Sizes'],
      summary: 'Create pizza size',
      operationId: 'createPizzaSize',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PizzaSizeInput' },
          },
        },
      },
      responses: {
        201: {
          description: 'Created',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PizzaSize' },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        409: error,
        500: error,
      },
    },
    get: {
      tags: ['Pizza Sizes'],
      summary: 'Search pizza sizes',
      operationId: 'searchPizzaSizes',
      parameters: ['id', 'name'].map((name) => ({
        name,
        in: 'query',
        required: false,
        description: 'Case-insensitive partial match',
        schema: { type: 'string' },
      })).concat({
        name: 'active',
        in: 'query',
        required: false,
        description: 'Filter by active status',
        schema: { type: 'boolean' },
      }),
      responses: {
        200: {
          description: 'Pizza sizes',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/PizzaSize' },
              },
            },
          },
        },
        400: error,
        500: error,
      },
    },
  },
  '/pizza-sizes/{id}': {
    get: {
      tags: ['Pizza Sizes'],
      summary: 'Get pizza size',
      operationId: 'getPizzaSize',
      parameters: [id],
      responses: {
        200: {
          description: 'Pizza size',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PizzaSize' },
            },
          },
        },
        400: error,
        404: error,
        500: error,
      },
    },
    put: {
      ...secured,
      tags: ['Pizza Sizes'],
      summary: 'Update pizza size',
      operationId: 'updatePizzaSize',
      parameters: [id],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PizzaSizeUpdate' },
          },
        },
      },
      responses: {
        200: {
          description: 'Updated',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PizzaSize' },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        404: error,
        409: error,
        500: error,
      },
    },
    delete: {
      ...secured,
      tags: ['Pizza Sizes'],
      summary: 'Delete pizza size if it is not referenced',
      operationId: 'deletePizzaSize',
      parameters: [id],
      responses: {
        204: { description: 'Deleted' },
        400: error,
        401: error,
        403: error,
        404: error,
        409: error,
        500: error,
      },
    },
  },
};
