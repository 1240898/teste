export function loadActivationInvitationConfig(env = process.env) {
  const validitySeconds = Number(
    env.ACTIVATION_INVITATION_TTL_SECONDS || 86400,
  );
  if (!Number.isSafeInteger(validitySeconds) || validitySeconds <= 0)
    throw new Error(
      'ACTIVATION_INVITATION_TTL_SECONDS must be a positive integer',
    );
  const webUrl =
    env.ACTIVATION_INVITATION_WEB_URL || 'http://localhost:5173/activate';
  try {
    new URL(webUrl);
  } catch {
    throw new Error('ACTIVATION_INVITATION_WEB_URL must be a valid URL');
  }
  return { validitySeconds, webUrl };
}
