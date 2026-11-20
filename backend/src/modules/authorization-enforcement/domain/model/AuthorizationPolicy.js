import { UserRole } from '../../../user-authentication-management/domain/model/values.js';
import { OperationPolicyEntry } from './OperationPolicyEntry.js';

const entries = [
  ['customers.create', [UserRole.MANAGER]],
  ['customers.search', [UserRole.MANAGER]],
  [
    'customers.getById',
    [UserRole.MANAGER, UserRole.CUSTOMER],
    { ownerScoped: true, ownershipExemptRoles: [UserRole.MANAGER] },
  ],
  ['customers.update', [UserRole.MANAGER]],
  ['customers.deactivate', [UserRole.MANAGER]],
  ['customers.activate', [UserRole.MANAGER]],
  ['products.create', [UserRole.MANAGER]],
  [
    'products.read',
    [UserRole.MANAGER, UserRole.EMPLOYEE, UserRole.CUSTOMER, UserRole.ADMINISTRATOR],
    { publicAccess: true },
  ],
  ['products.update', [UserRole.MANAGER]],
  ['products.deactivate', [UserRole.MANAGER]],
  ['products.activate', [UserRole.MANAGER]],
  ['categories.manage', [UserRole.MANAGER]],
  ['allergens.manage', [UserRole.MANAGER]],
  ['pizzaSizes.manage', [UserRole.MANAGER]],
  ['componentTypes.manage', [UserRole.MANAGER]],
  ['componentConfigurations.manage', [UserRole.MANAGER]],
  ['predefinedPizzas.manage', [UserRole.MANAGER]],
  ['stock.manage', [UserRole.MANAGER]],
  ['users.manage', [UserRole.ADMINISTRATOR]],
  ['securityAudit.read', [UserRole.ADMINISTRATOR]],
  ['listKitchenConfigurations', [UserRole.MANAGER]],
  ['getActiveKitchenConfiguration', [UserRole.MANAGER, UserRole.EMPLOYEE]],
  ['validateKitchenConfiguration', [UserRole.MANAGER]],
  ['createKitchenConfiguration', [UserRole.MANAGER]],
  ['getKitchenConfiguration', [UserRole.MANAGER]],
  ['updateKitchenConfiguration', [UserRole.MANAGER]],
  ['deleteKitchenConfiguration', [UserRole.MANAGER]],
  ['activateKitchenConfiguration', [UserRole.MANAGER]],
  ['listKitchenAssets', [UserRole.MANAGER]],
  // Public endpoints such as the catalogue deliberately have no role entry.
].map(([operationId, allowedRoles, options = {}]) =>
  new OperationPolicyEntry({ operationId, allowedRoles, ...options }),
);

const policyByOperation = new Map(entries.map((entry) => [entry.operationId, entry]));

/** Fixed role policy for the implemented API operations; unlisted operations fail closed. */
export class AuthorizationPolicy {
  static rolesFor(operationId) {
    return policyByOperation.get(operationId)?.allowedRoles ?? [];
  }

  static requiresOwnership(operationId, actorRoles = []) {
    const entry = policyByOperation.get(operationId);
    if (!entry?.ownerScoped) return false;
    return !entry.ownershipExemptRoles.some((role) => actorRoles.includes(role));
  }

  static entryFor(operationId) {
    return policyByOperation.get(operationId) ?? null;
  }

  static isPublic(operationId) {
    return policyByOperation.get(operationId)?.publicAccess === true;
  }
}
