export function loadPasswordRecoveryConfig(env = process.env) {
  const validitySeconds = Number(
    env.PASSWORD_RECOVERY_TOKEN_TTL_SECONDS || 1800,
  );
  if (!Number.isSafeInteger(validitySeconds) || validitySeconds <= 0)
    throw new Error(
      'PASSWORD_RECOVERY_TOKEN_TTL_SECONDS must be a positive integer',
    );

  const webUrl = env.PASSWORD_RECOVERY_WEB_URL || 'http://localhost:5173/';
  try {
    new URL(webUrl);
  } catch {
    throw new Error('PASSWORD_RECOVERY_WEB_URL must be a valid URL');
  }
  const smtpPort = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)
    throw new Error('SMTP_PORT must be between 1 and 65535');

  return {
    validitySeconds,
    webUrl,
    smtp: {
      host: env.SMTP_HOST,
      port: smtpPort,
      secure: env.SMTP_SECURE === 'true',
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
    },
  };
}
