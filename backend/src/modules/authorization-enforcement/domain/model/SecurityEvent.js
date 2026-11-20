export const SecurityOutcome = Object.freeze({
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  OWNERSHIP_DENIED: 'OWNERSHIP_DENIED',
});

/** Privacy-safe record of a denied request. Never add credentials or payloads. */
export class SecurityEvent {
  constructor({
    timestamp = new Date().toISOString(),
    outcome,
    method,
    routeTemplate,
    statusCode,
    actorId = null,
    actorRoles = [],
    requestId,
  }) {
    if (!Object.values(SecurityOutcome).includes(outcome))
      throw new TypeError('Invalid security outcome');
    if (typeof routeTemplate !== 'string' || routeTemplate.includes('?'))
      throw new TypeError('Security event requires a normalized route template');
    Object.assign(this, {
      timestamp,
      outcome,
      method,
      routeTemplate,
      statusCode,
      actorId,
      actorRoles: [...actorRoles],
      requestId,
    });
    Object.freeze(this.actorRoles);
    Object.freeze(this);
  }
}
