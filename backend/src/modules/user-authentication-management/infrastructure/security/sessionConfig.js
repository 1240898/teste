function positiveInteger(value, key) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error(`${key} must be a positive integer`);
  return parsed;
}

export function loadSessionConfig(env = process.env) {
  const idleTimeoutSeconds = positiveInteger(
    env.AUTH_IDLE_TIMEOUT_SECONDS,
    'AUTH_IDLE_TIMEOUT_SECONDS',
  );
  const activityReportIntervalSeconds = positiveInteger(
    env.ACTIVITY_REPORT_INTERVAL_SECONDS,
    'ACTIVITY_REPORT_INTERVAL_SECONDS',
  );
  const sessionRetentionSeconds = positiveInteger(
    env.SESSION_RETENTION_SECONDS ?? '604800',
    'SESSION_RETENTION_SECONDS',
  );
  // Production stays secure by default; HTTP-only deployments must opt out explicitly.
  const cookieSecure =
    env.SESSION_COOKIE_SECURE === undefined
      ? env.NODE_ENV === 'production'
      : env.SESSION_COOKIE_SECURE === 'true';
  const accessTokenTtl = env.ACCESS_TOKEN_TTL;
  const allowedOrigin = env.CORS_ORIGIN || 'http://localhost:5173';
  let originUrl;
  try {
    originUrl = new URL(allowedOrigin);
  } catch {
    throw new Error('CORS_ORIGIN must be an absolute origin URL');
  }
  if (
    originUrl.origin !== allowedOrigin ||
    originUrl.pathname !== '/' ||
    originUrl.search ||
    originUrl.hash
  )
    throw new Error(
      'CORS_ORIGIN must contain only scheme, host and optional port',
    );
  if (
    activityReportIntervalSeconds >= idleTimeoutSeconds ||
    activityReportIntervalSeconds > idleTimeoutSeconds / 2
  )
    throw new Error(
      'ACTIVITY_REPORT_INTERVAL_SECONDS must be below and at most half of AUTH_IDLE_TIMEOUT_SECONDS',
    );
  const duration = /^(\d+)(s|m|h|d)$/.exec(accessTokenTtl);
  const ttlSeconds =
    duration &&
    Number(duration[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[duration[2]];
  if (!ttlSeconds || ttlSeconds >= idleTimeoutSeconds || ttlSeconds > 86400)
    throw new Error(
      'ACCESS_TOKEN_TTL must be positive, no more than one day, and shorter than AUTH_IDLE_TIMEOUT_SECONDS',
    );
  if (activityReportIntervalSeconds * 2 >= ttlSeconds)
    throw new Error(
      'ACTIVITY_REPORT_INTERVAL_SECONDS must be less than half of ACCESS_TOKEN_TTL so renewal occurs before the JWT expires',
    );
  if (
    env.SESSION_COOKIE_SECURE !== undefined &&
    !['true', 'false'].includes(env.SESSION_COOKIE_SECURE)
  )
    throw new Error('SESSION_COOKIE_SECURE must be true or false');
  return {
    idleTimeoutSeconds,
    activityReportIntervalSeconds,
    sessionRetentionSeconds,
    cookieSecure,
    allowedOrigin,
    accessTokenTtl,
  };
}

export const sessionCookieName = (secure) =>
  secure ? '__Host-lap_session' : 'lap_session';
export const SESSION_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
});
