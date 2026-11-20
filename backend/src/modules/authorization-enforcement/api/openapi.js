const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });

const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});

export const securityAuditSchemas = {
  SecurityAuditEvent: object({
    requestId: { type: 'string', format: 'uuid' },
    timestamp: { type: 'string', format: 'date-time' },
    outcome: {
      type: 'string',
      enum: ['UNAUTHENTICATED', 'FORBIDDEN', 'OWNERSHIP_DENIED'],
    },
    method: { type: 'string', maxLength: 10 },
    routeTemplate: { type: 'string', maxLength: 255 },
    statusCode: { type: 'integer', enum: [401, 403, 404] },
    actorId: { type: 'string', nullable: true },
    actorRoles: { type: 'array', items: { type: 'string' } },
  }),
  SecurityAuditSearchResponse: object({
    items: {
      type: 'array',
      items: ref('SecurityAuditEvent'),
    },
    total: { type: 'integer', minimum: 0 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    offset: { type: 'integer', minimum: 0 },
  }),
  SecurityAuditError: object({
    error: object({
      message: { type: 'string' },
      status: { type: 'integer' },
    }),
  }),
};

const query = (name, description, schema) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema,
});

export const securityAuditPaths = {
  '/security/audit-logs': {
    get: {
      operationId: 'searchSecurityAuditLogs',
      summary: 'Search denied access audit events',
      description:
        'Restricted to Administrators. Results contain normalized route templates and never include credentials or request bodies.',
      tags: ['Security Audit'],
      security: [{ bearerAuth: [] }, { accessToken: [] }],
      parameters: [
        query('limit', 'Maximum results (default 50; maximum 100)', {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 50,
        }),
        query('offset', 'Number of results to skip', {
          type: 'integer',
          minimum: 0,
          default: 0,
        }),
        query('outcome', 'Filter by denial outcome', {
          type: 'string',
          enum: ['UNAUTHENTICATED', 'FORBIDDEN', 'OWNERSHIP_DENIED'],
        }),
        query('actorId', 'Filter by authenticated actor identifier', {
          type: 'string',
          pattern: '^USR-[0-9]{5,}$',
        }),
        query('from', 'Include events at or after this date and time', {
          type: 'string',
          format: 'date-time',
        }),
        query('to', 'Include events at or before this date and time', {
          type: 'string',
          format: 'date-time',
        }),
      ],
      responses: {
        200: {
          description: 'Matching security audit events',
          content: { 'application/json': { schema: ref('SecurityAuditSearchResponse') } },
        },
        400: {
          description: 'Invalid filters or pagination parameters',
          content: json(ref('SecurityAuditError')),
        },
        401: {
          description: 'Missing or invalid token',
          content: json(ref('SecurityAuditError')),
        },
        403: {
          description: 'Administrator role required',
          content: json(ref('SecurityAuditError')),
        },
        500: {
          description: 'Unexpected internal error',
          content: json(ref('SecurityAuditError')),
        },
      },
    },
  },
};
