import { CUSTOMER_ID_PATTERN } from '../domain/model/values.js';
const error = {
  description: 'Error response',
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Error' } },
  },
};
const secured = { security: [{ bearerAuth: [] }] };
const id = {
  name: 'id',
  in: 'path',
  required: true,
  schema: {
    type: 'string',
    pattern: CUSTOMER_ID_PATTERN,
    example: 'CUST-0001',
  },
};
export const customerSchemas = {
  CustomerInput: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'phoneNumber', 'email'],
    properties: {
      name: { type: 'string' },
      phoneNumber: { type: 'string', example: '+351912345678' },
      email: { type: 'string' },
      dietaryRestrictions: {
        type: 'array',
        items: { $ref: '#/components/schemas/DietaryRestriction' },
      },
      userId: { type: 'string', nullable: true },
    },
  },
  DietaryRestriction: {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
            allergenId: {
        type: 'integer',
        minimum: 1,
        maximum: 14,
        nullable: true,
        description:
          'Optional BCK04 allergen this restriction relates to (EU Regulation No. 1169/2011 number)',
        example: 7,
      },
    },
  },
  Customer: {
    type: 'object',
    required: [
      'id',
      'name',
      'phoneNumber',
      'email',
      'dietaryRestrictions',
      'userId',
      'active',
    ],
    properties: {
      id: {
        type: 'string',
        pattern: CUSTOMER_ID_PATTERN,
        example: 'CUST-0001',
      },
      name: { type: 'string' },
      phoneNumber: { type: 'string' },
      email: { type: 'string' },
      dietaryRestrictions: {
        type: 'array',
        items: { $ref: '#/components/schemas/DietaryRestriction' },
      },
      userId: { type: 'string', nullable: true },
      active: { type: 'boolean' },
    },
  },
  Error: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          status: { type: 'integer' },
        },
      },
    },
  },
};
export const customerPaths = {
  '/customers': {
    post: {
      ...secured,
      tags: ['Customers'],
      summary: 'Create customer',
      operationId: 'createCustomer',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CustomerInput' },
          },
        },
      },
      responses: {
        201: {
          description: 'Created',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Customer' },
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
      ...secured,
      tags: ['Customers'],
      summary: 'Search customers',
      operationId: 'searchCustomers',
      parameters: ['name', 'email', 'phoneNumber', 'userId'].map((name) => ({
        name,
        in: 'query',
        required: false,
        description:
          name === 'userId'
            ? 'Exact user id match'
            : 'Case-insensitive partial match',
        schema: { type: 'string' },
      })),
      responses: {
        200: {
          description: 'Customers',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Customer' },
              },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        500: error,
      },
    },
  },
  '/customers/{id}': {
    get: {
      ...secured,
      tags: ['Customers'],
      summary: 'Get customer',
      operationId: 'getCustomer',
      parameters: [id],
      responses: {
        200: {
          description: 'Customer',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Customer' },
            },
          },
        },
        400: error,
        401: error,
        403: error,
        404: error,
        500: error,
      },
    },
    put: {
      ...secured,
      tags: ['Customers'],
      summary: 'Replace customer',
      operationId: 'updateCustomer',
      parameters: [id],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CustomerInput' },
          },
        },
      },
      responses: {
        200: {
          description: 'Updated customer',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Customer' },
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
  },
  '/customers/{id}/deactivate': {
    patch: {
      ...secured,
      tags: ['Customers'],
      summary: 'Deactivate customer',
      operationId: 'deactivateCustomer',
      parameters: [id],
      responses: {
        204: { description: 'Deactivated' },
        400: error,
        401: error,
        403: error,
        404: error,
        500: error,
      },
    },
  },
  '/customers/{id}/activate': {
    patch: {
      ...secured,
      tags: ['Customers'],
      summary: 'Activate customer',
      operationId: 'activateCustomer',
      parameters: [id],
      responses: {
        204: { description: 'Activated' },
        400: error,
        401: error,
        403: error,
        404: error,
        500: error,
      },
    },
  },
};
