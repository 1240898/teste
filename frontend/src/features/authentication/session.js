// AA02: texts and helpers for the signed-in / signed-out feedback in the SPA.

// Table 1 website roles, as shown to the user (internal values come from the back end).
const ROLE_LABELS = Object.freeze({
  ADMINISTRATOR: 'Administrator',
  MANAGER: 'LaPrizza Manager',
  EMPLOYEE: 'Restaurant Staff',
  CUSTOMER: 'Customer',
});

export const SIGN_IN_TEXTS = Object.freeze({
  title: 'Sign in to LaPrizza',
  googleHint:
    'New to LaPrizza? Continue with Google and your customer account is created automatically, with no password to remember. If you already used Google before, you are simply signed in.',
});

export const SIGNED_OUT_MESSAGE =
  'You have logged out of LaPrizza. If you used Google, your Google account stays signed in on this browser.';

/** Human-readable role names; unknown values are shown as received. */
export function roleLabels(roles = []) {
  return roles.map((role) => ROLE_LABELS[role] ?? role);
}

/** Main line of the signed-in panel, e.g. "You are signed in as Ana Silva." */
export function signedInMessage(user) {
  return `You are signed in as ${user.name}.`;
}
