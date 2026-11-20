import { randomUUID } from 'node:crypto';
import { SecurityEvent, SecurityOutcome } from '../../domain/model/SecurityEvent.js';
import { captureRouteTemplate } from '../../../../shared/logging/routeTemplate.js';

export class AuthorizationAuditMiddleware {
  constructor(securityLogger) {
    if (typeof securityLogger?.record !== 'function')
      throw new TypeError('A security logger is required');
    this.securityLogger = securityLogger;
    this.auditDenials = this.auditDenials.bind(this);
  }

  auditDenials(req, res, next) {
    const requestId = randomUUID();
    res.once('finish', () => {
      const ownershipDenied =
        res.locals.authorizationOutcome === SecurityOutcome.OWNERSHIP_DENIED;
      const outcome =
        res.statusCode === 401
          ? SecurityOutcome.UNAUTHENTICATED
          : res.statusCode === 403
            ? SecurityOutcome.FORBIDDEN
            : ownershipDenied && res.statusCode === 404
              ? SecurityOutcome.OWNERSHIP_DENIED
              : null;
      if (!outcome) return;

      const event = new SecurityEvent({
        outcome,
        method: req.method,
        routeTemplate: req.authorizationRouteTemplate ?? captureRouteTemplate(req) ?? '/unmatched',
        statusCode: res.statusCode,
        actorId: req.user?.sub ?? null,
        actorRoles: req.user?.roles ?? [],
        requestId,
      });
      Promise.resolve(this.securityLogger.record(event))
        .catch(() => {
          // Preserve the authorization response and only log a correlation ID.
          console.error('Security audit event could not be written to durable outbox', {
            requestId,
          });
        });
    });
    next();
  }
}
