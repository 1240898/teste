import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import { registerModules } from './modules/index.js';
import { config } from './shared/config/index.js';
import { errorHandler, notFoundHandler } from './shared/errors/errorHandler.js';
import healthRoutes from './shared/health/routes.js';
import { requestLogger } from './shared/logging/requestLogger.js';
import { openApiSpec } from './shared/openapi/spec.js';
import { AuthorizationAuditMiddleware } from './modules/authorization-enforcement/api/middlewares/AuthorizationAuditMiddleware.js';
import { SecurityAuditLogger } from './modules/authorization-enforcement/infrastructure/SecurityAuditLogger.js';

const noOpSecurityLogger = Object.freeze({
  async record() {},
  async flush() {},
  async stop() {},
});

export function createApp({
  userModule,
  componentTypeModule,
  categoryModule,
  allergenModule,
  productModule,
  stockModule,
  pizzaSizeModule,
  customerModule,
  componentConfigurationModule,
  predefinedPizzaModule,
  catalogueModule,
  kitchenConfigurationModule,
  authorizationModule,
  securityLogger = config.isTest
    ? noOpSecurityLogger
    : new SecurityAuditLogger(),
} = {}) {
  const app = express();

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(requestLogger());
  app.use(express.json());

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  const apiV1 = express.Router();
  apiV1.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  apiV1.use(new AuthorizationAuditMiddleware(securityLogger).auditDenials);
  apiV1.use('/health', healthRoutes);
  registerModules(apiV1, {
    userModule,
    componentTypeModule,
    categoryModule,
    allergenModule,
    productModule,
    stockModule,
    pizzaSizeModule,
    customerModule,
    componentConfigurationModule,
    predefinedPizzaModule,
    catalogueModule,
    kitchenConfigurationModule,
    authorizationModule,
  });

  app.use('/api/v1', apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp();
