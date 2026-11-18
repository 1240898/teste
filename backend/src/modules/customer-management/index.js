import { Router } from 'express';
import { AuthMiddleware } from '../user-authentication-management/api/middlewares/authMiddleware.js';
import { CustomerController } from './api/controllers/customerController.js';
import { CustomerRoutes } from './api/routes/customerRoutes.js';
import { CustomerService } from './application/services/CustomerService.js';
import { CustomerRepository } from './infrastructure/persistence/CustomerRepository.js';
import { UserDirectoryAdapter } from './infrastructure/persistence/UserDirectoryAdapter.js';
export function createCustomerModule({
  database,
  userService,
  repository = new CustomerRepository(database),
  userDirectory = new UserDirectoryAdapter(database),
} = {}) {
  const service = new CustomerService(repository, userDirectory),
    router = Router();
  router.use(
    new CustomerRoutes(
      new CustomerController(service),
      new AuthMiddleware(userService),
    ).setupRoutes(),
  );
  return { router, customerService: service };
}
export function register(router, module) {
  if (module) router.use(module.router);
}
