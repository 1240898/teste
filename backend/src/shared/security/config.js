export function loadSecurityConfig(env = process.env) {
  if (
    !env.JWT_SECRET ||
    Buffer.byteLength(env.JWT_SECRET) < 32 ||
    !env.JWT_SECRET.trim()
  )
    throw new Error('JWT_SECRET must contain at least 32 bytes');
  const expiresIn = env.JWT_EXPIRES_IN || '1d';
  const match = /^(\d+)(s|m|h|d)$/.exec(expiresIn);
  const seconds =
    match && Number(match[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  if (!seconds || seconds > 86400)
    throw new Error('JWT_EXPIRES_IN must be between 1s and 1d');
  return {
    secret: env.JWT_SECRET,
    expiresIn,
    issuer: 'laprizza',
    audience: 'laprizza-api',
  };
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * AA02: Google Identity Services (OIDC) configuration.
 * Google sign-in is enabled by the client credentials: when GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET are both empty it is disabled (null) and local login keeps
 * working, even if GOOGLE_REDIRECT_URI keeps its default value. Only one of the
 * credentials, or an unsafe redirect URI, fails startup.
 * Error messages never include the client secret.
 */
export function loadExternalIdentityConfig(env = process.env) {
  const [clientId, clientSecret, redirectUri] = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
  ].map((key) => (typeof env[key] === 'string' ? env[key].trim() : ''));
  if (!clientId && !clientSecret) return null;
  if (!clientId || !clientSecret || !redirectUri)
    throw new Error(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI must all be set to enable Google sign-in',
    );
  let url;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new Error('GOOGLE_REDIRECT_URI must be an absolute URL');
  }
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
    throw new Error('GOOGLE_REDIRECT_URI must use HTTPS outside localhost');
  if (url.hash)
    throw new Error('GOOGLE_REDIRECT_URI must not contain a fragment');
  return { clientId, clientSecret, redirectUri };
}
