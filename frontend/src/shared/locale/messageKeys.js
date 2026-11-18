const knownMessages = new Map([
  [
    'This e-mail is already associated with an account. Sign in with your local credentials or use your activation invitation.',
    'googleEmailConflict',
  ],
  ['Account is not active', 'inactiveAccount'],
  ['No active role is assigned to this account', 'noActiveRole'],
  ['Invalid email or password', 'invalidCredentials'],
  ['Email already registered', 'emailRegistered'],
  ['Current password is incorrect', 'incorrectPassword'],
  [
    'The new password must differ from the current password',
    'differentPassword',
  ],
  [
    'The new password must differ from the current password by at least four characters',
    'passwordDifference',
  ],
  [
    'Password changed. Sign in again with your new password.',
    'passwordChangedSignIn',
  ],
  ['This account has no local password', 'noLocalPassword'],
  ['Invalid or expired recovery link', 'recoveryInvalid'],
  [
    'We could not confirm your permissions. Please sign in again.',
    'authUnconfirmed',
  ],
  [
    'Your session could not be restored. Please sign in again.',
    'sessionRestoreFailed',
  ],
  ['Your session expired. Please sign in again.', 'sessionExpired'],
  ['Signing out…', 'signingOut'],
  ['Logout could not be confirmed. Retry logout.', 'logoutUnconfirmed'],
  [
    'Google sign-in was cancelled. You have not been signed in.',
    'googleCancelled',
  ],
  ['Sign-in could not be completed. Please try again.', 'googleIncomplete'],
  [
    'Google sign-in failed. Please try again or use local sign-in.',
    'googleFailed',
  ],
  ['At least one active Administrator must remain', 'lastAdministrator'],
  ['User not found', 'userNotFound'],
]);

export function messageKey(message, fallback = 'unknownMessage') {
  if (knownMessages.has(message)) return knownMessages.get(message);
  if (
    typeof message === 'string' &&
    message.startsWith('Password must contain at least 12 characters')
  )
    return 'passwordPolicy';
  return fallback;
}

export function apiMessageKey(error, fallback) {
  if (error?.kind === 'network' || error?.kind === 'timeout')
    return 'connectionError';
  if (error?.status === 403)
    return messageKey(error.message, 'insufficientPermission');
  return messageKey(error?.message, fallback);
}
