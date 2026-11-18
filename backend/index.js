import { createApp } from './src/app.js';
import { createUserModule } from './src/modules/user-authentication-management/index.js';
import { createAllergenModule } from './src/modules/allergen-management/index.js';
import { createProductCategoryModule } from './src/modules/product-category-management/index.js';
import { createPizzaComponentTypeModule } from './src/modules/pizza-component-type-management/index.js';
import { createProductManagementModule } from './src/modules/product-management/index.js';
import { createStockModule } from './src/modules/stock-information-management/index.js';
import { createPredefinedPizzaManagementModule } from './src/modules/predefined-pizza-management/index.js';
import { createCustomerModule } from './src/modules/customer-management/index.js';
import {
  loadSecurityConfig,
  loadExternalIdentityConfig,
} from './src/shared/security/config.js';
import { config } from './src/shared/config/index.js';
import { createDatabase } from './src/shared/persistence/postgres/index.js';
import { AuthMiddleware } from './src/modules/user-authentication-management/api/middlewares/authMiddleware.js';
import { createPizzaSizeModule } from './src/modules/pizza-size-management/index.js';
import { createPizzaComponentConfigurationModule } from './src/modules/pizza-component-configuration/index.js';
import { createCatalogueModule } from './src/modules/product-catalogue-and-information/index.js';
import { createKitchenConfigurationModule } from './src/modules/kitchen-configuration-management/index.js';

let database;
try {
    const security = loadSecurityConfig();
  // AA02: null (Google sign-in disabled) when no Google credentials are set.
  const externalIdentity = loadExternalIdentityConfig();
  database = createDatabase();
  await database.verify();
  const userModule = createUserModule({ database, security, externalIdentity });
  const { userService } = userModule;
  const authMiddleware = new AuthMiddleware(userService);

  const categoryModule = createProductCategoryModule({ database, userService });
  const allergenModule = createAllergenModule({ database, userService });
  const componentTypeModule = createPizzaComponentTypeModule({
    database,
    authMiddleware,
  });
  const stockModule = createStockModule({ database, authMiddleware });
  const productModule = createProductManagementModule({
    database,
    authMiddleware,
  });
  const pizzaSizeModule = createPizzaSizeModule({
    database,
    userService: userModule.userService,
  });
  const customerModule = createCustomerModule({
    database,
    userService: userModule.userService,
  });

  const componentConfigurationModule = createPizzaComponentConfigurationModule({
    database,
    authMiddleware,
    products: productModule.productRepository,
    sizes: pizzaSizeModule.repository,
  });
  const predefinedPizzaModule = createPredefinedPizzaManagementModule({
    database,
    authMiddleware,
    productRepository: productModule.productRepository,
  });
  const catalogueModule = createCatalogueModule({ database });

  const kitchenConfigurationModule = createKitchenConfigurationModule({
    database,
    authMiddleware,
  });
  
  const app = createApp({
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
  });

  app.locals.database = database;
  const server = app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
    console.log(`OpenAPI docs at http://localhost:${config.port}/api-docs`);
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    userModule.dispose?.();
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    server.close(async () => {
      try {
        await database.close();
      } catch {
        process.exitCode = 1;
      } finally {
        clearTimeout(deadline);
      }
    });
  };
  server.on('error', () => {
    console.error('HTTP server failed');
    process.exitCode = 1;
    shutdown();
  });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  console.error(
    'API startup failed. Check security configuration, database configuration and availability.',
  );
  console.error('Startup error:', {
    name: error?.name,
    code: error?.code,
    message: error?.message,
  });
  await database?.close();
  process.exitCode = 1;
}
