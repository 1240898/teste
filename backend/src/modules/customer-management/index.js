import { Router } from 'express';
import { AuthMiddleware } from '../user-authentication-management/api/middlewares/authMiddleware.js';
import { CustomerController } from './api/controllers/customerController.js';
import { CustomerRoutes } from './api/routes/customerRoutes.js';
import { CustomerService } from './application/services/CustomerService.js';
import { CustomerRepository } from './infrastructure/persistence/CustomerRepository.js';
import { UserDirectoryAdapter } from './infrastructure/persistence/UserDirectoryAdapter.js';
import { AllergenCatalogueAdapter } from './infrastructure/persistence/AllergenCatalogueAdapter.js';
import { CustomerAccountProfileService } from './application/services/CustomerAccountProfileService.js';
export function createCustomerModule({
  database,
  userService,
  repository = new CustomerRepository(database),
  userDirectory = new UserDirectoryAdapter(database),
  allergenCatalogue = new AllergenCatalogueAdapter(database),
} = {}) {
  const service = new CustomerService(
      repository,
      userDirectory,
      allergenCatalogue,
    ),
    router = Router();
  router.use(
    new CustomerRoutes(
      new CustomerController(service),
      new AuthMiddleware(userService),
    ).setupRoutes(),
  );
  return { router, customerService: service };
}
/**
 * GDP01: customer-record creation used by local registration (user module port
 * `customerProfiles`). Built before the user module, so it only needs the database.
 */
export function createCustomerAccountProfiles({
  database,
  repository = new CustomerRepository(database),
} = {}) {
  return new CustomerAccountProfileService(repository);
}
export function register(router, module) {
  if (module) router.use(module.router);
}