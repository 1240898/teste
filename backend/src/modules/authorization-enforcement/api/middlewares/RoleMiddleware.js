import { AppError } from '../../../../shared/errors/AppError.js';
import { AuthorizationPolicy } from '../../domain/model/AuthorizationPolicy.js';
import { captureRouteTemplate } from '../../../../shared/logging/routeTemplate.js';

export class RoleMiddleware {
  /** Compatibility for existing middleware consumers not yet assigned operation IDs. */
  static requireRole(...roles) {
    return (req, _res, next) => {
      if (!req.user) throw new AppError('Authentication required', 401);
      if (!roles.some((role) => req.user.roles.includes(role)))
        throw new AppError('Forbidden: insufficient permissions', 403);
      next();
    };
  }

  static requireOperation(operationId) {
    return (req, _res, next) => {
      captureRouteTemplate(req);
      if (!req.user && AuthorizationPolicy.isPublic(operationId)) return next();
      if (!req.user) throw new AppError('Authentication required', 401);
      const roles = AuthorizationPolicy.rolesFor(operationId);
      if (
        !roles.some((role) => req.user.roles.includes(role)) &&
        !AuthorizationPolicy.isPublic(operationId)
      )
        throw new AppError('Forbidden: insufficient permissions', 403);
      next();
    };
  }
}
