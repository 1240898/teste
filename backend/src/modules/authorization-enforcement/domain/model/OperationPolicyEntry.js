import { UserRole } from '../../../user-authentication-management/domain/model/values.js';

export class OperationPolicyEntry {
  constructor({
    operationId,
    allowedRoles,
    publicAccess = false,
    ownerScoped = false,
    ownershipExemptRoles = [],
  }) {
    if (typeof operationId !== 'string' || !operationId.trim())
      throw new TypeError('Invalid operation identifier');
    const validRoles = new Set(Object.values(UserRole));
    if (
      !Array.isArray(allowedRoles) ||
      allowedRoles.some((role) => !validRoles.has(role)) ||
      !Array.isArray(ownershipExemptRoles) ||
      ownershipExemptRoles.some((role) => !validRoles.has(role))
    )
      throw new TypeError('Invalid authorization policy roles');
    this.operationId = operationId;
    this.allowedRoles = Object.freeze([...new Set(allowedRoles)]);
    this.publicAccess = publicAccess === true;
    this.ownerScoped = Boolean(ownerScoped);
    this.ownershipExemptRoles = Object.freeze([
      ...new Set(ownershipExemptRoles),
    ]);
    Object.freeze(this);
  }
}
