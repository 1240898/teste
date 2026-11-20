import { AuthorizationPolicy } from '../../../src/modules/authorization-enforcement/domain/model/AuthorizationPolicy.js';
import { UserRole } from '../../../src/modules/user-authentication-management/domain/model/values.js';

describe('AA05 authorization policy', () => {
  test.each([
    [UserRole.ADMINISTRATOR, true],
    [UserRole.MANAGER, false],
    [UserRole.EMPLOYEE, false],
    [UserRole.CUSTOMER, false],
  ])('only Administrator can read security logs (%s)', (role, allowed) => {
    expect(
      AuthorizationPolicy.rolesFor('securityAudit.read').includes(role),
    ).toBe(allowed);
  });

  test('accepts any permitted role and keeps ownership checks operation-specific', () => {
    expect(AuthorizationPolicy.rolesFor('products.read')).toContain(
      UserRole.EMPLOYEE,
    );
    expect(
      AuthorizationPolicy.requiresOwnership('customers.getById', [
        UserRole.CUSTOMER,
        UserRole.EMPLOYEE,
      ]),
    ).toBe(true);
    expect(
      AuthorizationPolicy.requiresOwnership('customers.getById', [
        UserRole.MANAGER,
        UserRole.CUSTOMER,
      ]),
    ).toBe(false);
    expect(AuthorizationPolicy.rolesFor('unlisted.operation')).toEqual([]);
    expect(AuthorizationPolicy.rolesFor('catalogue.read')).toEqual([]);
  });

  test('public product reads include Guests and all authenticated roles', () => {
    expect(AuthorizationPolicy.isPublic('products.read')).toBe(true);
    expect(AuthorizationPolicy.rolesFor('products.read')).toEqual(
      expect.arrayContaining(Object.values(UserRole)),
    );
  });

  test.each([
    ['listKitchenConfigurations', [UserRole.MANAGER]],
    ['getActiveKitchenConfiguration', [UserRole.MANAGER, UserRole.EMPLOYEE]],
    ['validateKitchenConfiguration', [UserRole.MANAGER]],
    ['createKitchenConfiguration', [UserRole.MANAGER]],
    ['getKitchenConfiguration', [UserRole.MANAGER]],
    ['updateKitchenConfiguration', [UserRole.MANAGER]],
    ['deleteKitchenConfiguration', [UserRole.MANAGER]],
    ['activateKitchenConfiguration', [UserRole.MANAGER]],
    ['listKitchenAssets', [UserRole.MANAGER]],
  ])('registers kitchen operation %s in the central policy', (operationId, roles) => {
    expect(AuthorizationPolicy.rolesFor(operationId)).toEqual(roles);
  });
});
