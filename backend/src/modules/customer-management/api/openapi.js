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
        description: 'Omit on update to leave dietary restrictions unchanged.',
      },
      userId: { type: 'string', nullable: true },
      healthDataConsent: {
        type: 'boolean',
        description:
          'GDP01: the customer gave explicit consent for allergen/dietary data (GDPR Art. 9(2)(a)). Existing consent covers later updates when omitted. False withdraws consent and erases the restrictions.',
      },
    },
  },
  HealthDataConsent: {
    type: 'object',
    required: ['given', 'timestamp'],
    properties: {
      given: { type: 'boolean' },
      timestamp: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  CustomerProfileCompletion: {
    type: 'object',
    additionalProperties: false,
    required: ['phoneNumber'],
    properties: {
      phoneNumber: { type: 'string', example: '+351912345678' },
    },
  },
  CustomerProfileUpdate: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'phoneNumber'],
    properties: {
      name: { type: 'string', maxLength: 100 },
      phoneNumber: { type: 'string', example: '+351912345678' },
    },
  },
  CustomerAllergensUpdate: {
    type: 'object',
    additionalProperties: false,
    required: ['healthDataConsent'],
    properties: {
      healthDataConsent: { type: 'boolean' },
      allergenIds: {
        type: 'array',
        uniqueItems: true,
        items: { type: 'integer', minimum: 1, maximum: 14 },
        description: 'Must be empty when healthDataConsent is false.',
      },
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
      healthDataConsent: { $ref: '#/components/schemas/HealthDataConsent' },
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
const customer = {
  description: 'Customer',
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Customer' } },
  },
};
const body = (name) => ({
  required: true,
  content: {
    'application/json': { schema: { $ref: `#/components/schemas/${name}` } },
  },
});
export const customerPaths = {
  // GDP01: the authenticated Customer's own record (Sprint 2 Table 1).
  '/customers/me': {
    get: {
      ...secured,
      tags: ['Customers'],
      summary: 'Get my customer record',
      description:
        '404 means the profile is not completed (e.g. first Google sign-in) and must be completed with POST before using customer features.',
      operationId: 'getMyCustomer',
      responses: {
        200: customer,
        401: error,
        403: error,
        404: error,
        500: error,
      },
    },
    post: {
      ...secured,
      tags: ['Customers'],
      summary: 'Complete my customer profile (phone number)',
      operationId: 'completeMyCustomer',
      requestBody: body('CustomerProfileCompletion'),
      responses: {
        201: customer,
        400: error,
        401: error,
        403: error,
        409: error,
        500: error,
      },
    },
    put: {
      ...secured,
      tags: ['Customers'],
      summary: 'Update my name and phone number',
      operationId: 'updateMyCustomer',
      requestBody: body('CustomerProfileUpdate'),
      responses: {
        200: customer,
        400: error,
        401: error,
        403: error,
        404: error,
        500: error,
      },
    },
  },
  '/customers/me/allergens': {
    put: {
      ...secured,
      tags: ['Customers'],
      summary: 'Set my allergens and health-data consent',
      operationId: 'updateMyAllergens',
      requestBody: body('CustomerAllergensUpdate'),
      responses: {
        200: customer,
        400: error,
        401: error,
        403: error,
        404: error,
        500: error,
      },
    },
  },
  '/customers/{id}': {
    get: {
      ...secured,
      tags: ['Customers'],
      summary: 'Get customer',
      description:
        'Managers can read any customer record. Customers can read only their own record.',
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
      summary: 'Update customer',
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
