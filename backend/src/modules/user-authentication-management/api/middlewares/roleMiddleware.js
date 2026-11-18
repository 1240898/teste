import { AppError } from '../../../../shared/errors/AppError.js';

export class RoleMiddleware {
  static requireRole(...roles) {
    return (req, _res, next) => {
      if (!req.user) throw new AppError('Authentication required', 401);
      if (!roles.some((role) => req.user.roles.includes(role)))
        throw new AppError('Forbidden: insufficient permissions', 403);
      next();
    };
  }
}
