import { MAX_STOCK_UNITS } from '../domain/model/values.js';

const managerSecurity = [{ bearerAuth: [] }];
const errorResponse = {
  $ref: '#/components/schemas/StockError',
};

const jsonResponse = (description, schema) => ({
  description,
  content: { 'application/json': { schema } },
});

const responsesWithErrors = (successCode, successDescription, schema) => ({
  [successCode]: jsonResponse(successDescription, schema),
  400: jsonResponse('Invalid request', errorResponse),
  401: jsonResponse('Authentication required', errorResponse),
  403: jsonResponse('Manager role required', errorResponse),
  404: jsonResponse('Product or stock information not found', errorResponse),
  409: jsonResponse(
    'Insufficient stock, stock quantity limit, or stock-control lifecycle conflict',
    errorResponse,
  ),
  500: jsonResponse('Unexpected server error', errorResponse),
});

const productPathParameter = {
  name: 'productId',
  in: 'path',
  required: true,
  schema: {
    type: 'string',
    pattern: '^PROD-[0-9]{5,}$',
    maxLength: 32,
  },
};

export const stockPaths = {
  '/stock': {
    post: {
      summary: 'Start stock tracking for a product',
      operationId: 'startProductStockTracking',
      tags: ['Stock Information'],
      security: managerSecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/StartStockTrackingRequest' },
          },
        },
      },
      responses: responsesWithErrors(201, 'Current stock tracking started', {
        $ref: '#/components/schemas/StockResponse',
      }),
    },
    get: {
      summary: 'Search current or historical stock periods',
      operationId: 'searchStock',
      tags: ['Stock Information'],
      security: managerSecurity,
      parameters: [
        {
          name: 'productId',
          in: 'query',
          schema: {
            type: 'string',
            pattern: '^PROD-[0-9]{5,}$',
            maxLength: 32,
          },
        },
        {
          name: 'productName',
          in: 'query',
          schema: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
          },
        },
        {
          name: 'isActive',
          in: 'query',
          description:
            'Filter by Product state. Omit to include active and inactive Products.',
          schema: { type: 'boolean' },
        },
        {
          name: 'historical',
          in: 'query',
          description:
            'When true, returns only ended periods (endedAt is not null). Omit or set false to return only current periods (endedAt is null).',
          schema: { type: 'boolean', default: false },
        },
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        {
          name: 'pageSize',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: responsesWithErrors(200, 'Matching stock page', {
        $ref: '#/components/schemas/StockSearchResult',
      }),
    },
  },
  '/stock/{productId}': {
    get: {
      summary: 'Consult current stock for a product',
      operationId: 'getProductStock',
      tags: ['Stock Information'],
      security: managerSecurity,
      parameters: [productPathParameter],
      responses: responsesWithErrors(200, 'Current stock information', {
        $ref: '#/components/schemas/StockResponse',
      }),
    },
    delete: {
      summary: 'Stop current tracking and preserve the final stock quantity',
      operationId: 'stopProductStockTracking',
      tags: ['Stock Information'],
      security: managerSecurity,
      parameters: [productPathParameter],
      responses: {
        204: { description: 'Tracking period ended and retained' },
        400: jsonResponse('Invalid request', errorResponse),
        401: jsonResponse('Authentication required', errorResponse),
        403: jsonResponse('Manager role required', errorResponse),
        404: jsonResponse('Product or current stock not found', errorResponse),
        500: jsonResponse('Unexpected server error', errorResponse),
      },
    },
  },
  '/stock/{productId}/adjustments': {
    post: {
      summary: 'Increase or decrease current stock',
      operationId: 'adjustProductStock',
      tags: ['Stock Information'],
      security: managerSecurity,
      parameters: [
        {
          ...productPathParameter,
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/StockAdjustmentRequest' },
          },
        },
      },
      responses: responsesWithErrors(200, 'Adjusted stock information', {
        $ref: '#/components/schemas/StockAdjustmentResult',
      }),
    },
  },
};

export const stockSchemas = {
  StartStockTrackingRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['productId'],
    properties: {
      productId: { type: 'string', pattern: '^PROD-[0-9]{5,}$', maxLength: 32 },
      initialUnits: {
        type: 'integer',
        minimum: 0,
        maximum: MAX_STOCK_UNITS,
        default: 0,
        example: 12,
      },
    },
  },
  StockResponse: {
    type: 'object',
    required: [
      'stockId',
      'productId',
      'productName',
      'availableUnits',
      'startedAt',
      'endedAt',
    ],
    properties: {
      stockId: { type: 'string', example: 'STOCK-00001' },
      productId: { type: 'string', example: 'PROD-00123' },
      productName: { type: 'string', example: 'Mozzarella' },
      availableUnits: {
        type: 'integer',
        minimum: 0,
        maximum: MAX_STOCK_UNITS,
        example: 42,
      },
      startedAt: { type: 'string', format: 'date-time' },
      endedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  StockAdjustmentRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['direction', 'units'],
    properties: {
      direction: { type: 'string', enum: ['INCREASE', 'DECREASE'] },
      units: {
        type: 'integer',
        minimum: 1,
        maximum: MAX_STOCK_UNITS,
        example: 3,
      },
    },
  },
  StockAdjustmentResult: {
    type: 'object',
    required: [
      'stockId',
      'productId',
      'productName',
      'direction',
      'adjustedUnits',
      'availableUnits',
    ],
    properties: {
      stockId: { type: 'string', example: 'STOCK-00001' },
      productId: { type: 'string', example: 'PROD-00123' },
      productName: { type: 'string', example: 'Mozzarella' },
      direction: { type: 'string', enum: ['INCREASE', 'DECREASE'] },
      adjustedUnits: {
        type: 'integer',
        minimum: 1,
        maximum: MAX_STOCK_UNITS,
        example: 3,
      },
      availableUnits: {
        type: 'integer',
        minimum: 0,
        maximum: MAX_STOCK_UNITS,
        example: 39,
      },
    },
  },
  StockSearchResult: {
    type: 'object',
    required: ['items', 'page', 'pageSize', 'totalItems'],
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/StockResponse' },
      },
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100 },
      totalItems: { type: 'integer', minimum: 0 },
    },
  },
  StockError: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['message', 'status'],
        properties: {
          message: { type: 'string' },
          status: { type: 'integer' },
        },
      },
    },
  },
};
