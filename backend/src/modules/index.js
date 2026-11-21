/**
 * Composition root for domain modules.
 */
import { register as registerAllergenManagement } from './allergen-management/index.js';
import { register as registerCustomerManagement } from './customer-management/index.js';
import { register as registerPizzaComponentConfiguration } from './pizza-component-configuration/index.js';
import { register as registerPizzaComponentTypeManagement } from './pizza-component-type-management/index.js';
import { register as registerPizzaSizeManagement } from './pizza-size-management/index.js';
import { register as registerPredefinedPizzaManagement } from './predefined-pizza-management/index.js';
import { register as registerProductCatalogueAndInformation } from './product-catalogue-and-information/index.js';
import { register as registerProductCategoryManagement } from './product-category-management/index.js';
import { register as registerProductManagement } from './product-management/index.js';
import { register as registerStockInformationManagement } from './stock-information-management/index.js';
import { register as registerUserAuthenticationManagement } from './user-authentication-management/index.js';
import { register as registerKitchenConfigurationManagement } from './kitchen-configuration-management/index.js';
import { register as registerAuthorizationEnforcement } from './authorization-enforcement/index.js';
import { register as registerSharedResources } from './shared-resources/index.js';
import { register as registerPlanningInputs } from './planning-inputs/index.js';

export function registerModules(
  router,
  {
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
    sharedResourcesModule,
    forecastModule,
    procurementScenarios,
    planningInputModule,
  } = {},
) {
  registerUserAuthenticationManagement(router, userModule);
  registerCustomerManagement(router, customerModule);
  registerProductCategoryManagement(router, categoryModule);
  registerAllergenManagement(router, allergenModule);
  registerProductManagement(router, productModule);
  registerPizzaSizeManagement(router, pizzaSizeModule);
  registerPizzaComponentTypeManagement(router, componentTypeModule);
  registerPizzaComponentConfiguration(router, componentConfigurationModule);
  registerStockInformationManagement(router, stockModule);
  registerPredefinedPizzaManagement(router, predefinedPizzaModule);
  registerProductCatalogueAndInformation(router, catalogueModule);
  registerKitchenConfigurationManagement(router, kitchenConfigurationModule);
  registerAuthorizationEnforcement(router, authorizationModule);
  registerSharedResources(router, sharedResourcesModule);
  if (forecastModule) router.use(forecastModule.router);
  if (procurementScenarios) router.use(procurementScenarios.router);
  registerPlanningInputs(router, planningInputModule);
}
