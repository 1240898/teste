import { AppError } from '../../../../shared/errors/AppError.js';
import { AuthorizationPolicy } from '../../domain/model/AuthorizationPolicy.js';
import { SecurityOutcome } from '../../domain/model/SecurityEvent.js';

export class OwnershipMiddleware {
  constructor(resolver) {
    if (typeof resolver?.isOwner !== 'function')
      throw new TypeError('An ownership resolver is required');
    this.resolver = resolver;
  }

  requireOwnership(operationId, resourceIdParam) {
    return async (req, res, next) => {
      if (!req.user) throw new AppError('Authentication required', 401);
      if (!AuthorizationPolicy.requiresOwnership(operationId, req.user.roles))
        return next();

      const resourceId = req.params?.[resourceIdParam];
      if (
        typeof resourceId !== 'string' ||
        !(await this.resolver.isOwner(req.user, resourceId))
      ) {
        res.locals.authorizationOutcome = SecurityOutcome.OWNERSHIP_DENIED;
        return res.status(404).json({
          error: { message: 'Not found', status: 404 },
        });
      }
      return next();
    };
  }
}
