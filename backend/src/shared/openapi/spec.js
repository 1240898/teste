import { managerPlanningPaths } from '../../modules/forecast-planning/openapi.js';
import { createRequire } from 'node:module';
import { sharedResourcesPaths } from '../../modules/shared-resources/openapi.js';
import { planningInputPaths, planningInputSchemas, planningInputSecurity } from '../../modules/planning-inputs/api/openapi.js';
import {
  userPaths,
  userSchemas,
} from '../../modules/user-authentication-management/api/openapi.js';
import {
  componentTypePaths,
  componentTypeSchemas,
} from '../../modules/pizza-component-type-management/api/openapi.js';
import {
  stockPaths,
  stockSchemas,
} from '../../modules/stock-information-management/api/openapi.js';

import {
  componentConfigurationPaths,
  componentConfigurationSchemas,
} from '../../modules/pizza-component-configuration/api/openapi.js';

import {
  categoryPaths,
  categorySchemas,
} from '../../modules/product-category-management/api/openapi.js';
import {
  pizzaSizePaths,
  pizzaSizeSchemas,
} from '../../modules/pizza-size-management/api/openapi.js';

import {
  allergenPaths,
  allergenSchemas,
} from '../../modules/allergen-management/api/openapi.js';
import {
  productPaths,
  productSchemas,
} from '../../modules/product-management/api/openapi.js';
import {
  customerPaths,
  customerSchemas,
} from '../../modules/customer-management/api/openapi.js';
import {
  predefinedPizzaPaths,
  predefinedPizzaSchemas,
} from '../../modules/predefined-pizza-management/api/openapi.js';
import {
  cataloguePaths,
  catalogueSchemas,
} from '../../modules/product-catalogue-and-information/api/openapi.js';
import {
  securityAuditPaths,
  securityAuditSchemas,
} from '../../modules/authorization-enforcement/api/openapi.js';

import {
  kitchenConfigurationPaths,
  kitchenConfigurationSchemas,
} from '../../modules/kitchen-configuration-management/api/openapi.js';

const require = createRequire(import.meta.url);
const { version } = require('../../../package.json');

/**
 * OpenAPI 3 contract for health and the implemented backend modules.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'LaPrizza API',
    version,
    description:
      'LaPrizza backend API: health, user management, customers, authentication, product catalogue, Pizza Component Types, product categories, Pizza Sizes, component-size configurations, stock management, kitchen configuration, predefined pizzas and Administrator-only security audit logs.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Versioned API prefix',
    },
  ],
  components: {
    securitySchemes: {
      ...planningInputSecurity,
      accessToken: {
        type: 'apiKey',
        in: 'header',
        name: 'x-access-token',
        description:
          'Alternative JWT transport supported by the original design. Conflicting token headers are rejected.',
      },
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'lap_session',
        description: 'HttpOnly renewal credential; production cookie uses the __Host-lap_session name.',
      },
    },

    schemas: {
      ...planningInputSchemas,
      ...userSchemas,
      ...componentTypeSchemas,
      ...categorySchemas,
      ...allergenSchemas,
      ...productSchemas,
      ...stockSchemas,
      ...pizzaSizeSchemas,
      ...customerSchemas,
      ...componentConfigurationSchemas,
      ...predefinedPizzaSchemas,
      ...catalogueSchemas,
      ...kitchenConfigurationSchemas,
      ...securityAuditSchemas,
    },
  },
  paths: {
    ...planningInputPaths,
    ...managerPlanningPaths,
    ...userPaths,
    ...componentTypePaths,
    ...categoryPaths,
    ...allergenPaths,
    ...productPaths,
    ...stockPaths,
    ...pizzaSizePaths,
    ...customerPaths,
    ...componentConfigurationPaths,
    ...predefinedPizzaPaths,
    ...cataloguePaths,
    ...kitchenConfigurationPaths,
    ...securityAuditPaths,
    ...sharedResourcesPaths,

    '/health': {
      get: {
        summary: 'Health check',
        operationId: 'getHealth',
        responses: {
          200: {
            description: 'Service is reachable',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'version', 'timestamp'],
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    version: { type: 'string', example: '1.0.0' },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      example: '2026-01-01T00:00:00.000Z',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export { version };
