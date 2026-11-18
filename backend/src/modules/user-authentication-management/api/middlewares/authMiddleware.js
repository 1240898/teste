import { AppError } from '../../../../shared/errors/AppError.js';

export class AuthMiddleware {
  constructor(userService) {
    this.userService = userService;
    this.verifyToken = this.verifyToken.bind(this);
  }

  async verifyToken(req, _res, next) {
    const authorization = req.headers.authorization;
    const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');
    const legacy = req.headers['x-access-token'];
    if (
      (authorization && !match) ||
      (legacy && typeof legacy !== 'string') ||
      (match && legacy && match[1] !== legacy)
    )
      throw new AppError('Invalid or expired token', 401);
    const token = match?.[1] ?? legacy;
    if (!token) throw new AppError('No token provided', 401);
    // Preserve req.user and token verification, then refresh mutable authorization state.
    req.user = await this.userService.resolveActor(token);
    next();
  }
}
