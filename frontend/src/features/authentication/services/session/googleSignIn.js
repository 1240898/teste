import { completeGoogleLogin, startGoogleLogin } from './authApi.js';
import { activationApi, ACTIVATION_STATE_KEY } from '../activationApi.js';

export const OIDC_STATE_KEY = 'oidc_state';

export const MESSAGES = Object.freeze({
  cancelled: 'Google sign-in was cancelled. You have not been signed in.',
  incomplete: 'Sign-in could not be completed. Please try again.',
  failed: 'Google sign-in failed. Please try again or use local sign-in.',
});

/** AA02 (SD 1): starts Google sign-in; the state is kept to be compared on return. */
export async function beginGoogleSignIn({
  api = { startGoogleLogin },
  storage = window.sessionStorage,
  navigate = (url) => window.location.assign(url),
} = {}) {
  const { authorizationUrl, state } = await api.startGoogleLogin();
  storage.removeItem(ACTIVATION_STATE_KEY);
  storage.setItem(OIDC_STATE_KEY, state);
  navigate(authorizationUrl);
}

export async function beginGoogleActivation(
  token,
  {
    api = activationApi,
    storage = window.sessionStorage,
    navigate = (url) => window.location.assign(url),
  } = {},
) {
  const { authorizationUrl, state } = await api.startExternal(token);
  storage.removeItem(OIDC_STATE_KEY);
  storage.setItem(ACTIVATION_STATE_KEY, state);
  navigate(authorizationUrl);
}

/**
 * AA02 (SD 1 / SD 3): handles the redirect back from Google.
 * Never calls the back end when the user cancelled or the state does not match.
 */
export async function handleGoogleRedirect(
  query,
  {
    api = { completeGoogleLogin },
    activation = activationApi,
    storage = window.sessionStorage,
  } = {},
) {
  const activationState = storage.getItem(ACTIVATION_STATE_KEY);
  if (activationState) {
    storage.removeItem(ACTIVATION_STATE_KEY);
    const code = query.get('code');
    const state = query.get('state');
    if (query.get('error') || !code || state !== activationState)
      return { status: 'activation-error', key: 'activationGoogleFailed' };
    try {
      const result = await activation.completeExternal(code, state);
      if (result.status === 'ACTIVATED') return { status: 'activated' };
      if (result.status === 'SIGNED_IN' && result.auth)
        return { status: 'signed-in', session: result.auth };
    } catch (error) {
      if (error?.message === 'This invitation can no longer be used.')
        return { status: 'activation-error', key: 'activationUnavailable' };
    }
    return { status: 'activation-error', key: 'activationGoogleFailed' };
  }
  const expectedState = storage.getItem(OIDC_STATE_KEY);
  storage.removeItem(OIDC_STATE_KEY);
  if (query.get('error'))
    return { status: 'error', message: MESSAGES.cancelled };
  const code = query.get('code');
  const state = query.get('state');
  if (!code || !state || !expectedState || state !== expectedState)
    return { status: 'error', message: MESSAGES.incomplete };
  try {
    const session = await api.completeGoogleLogin(code, state);
    return { status: 'signed-in', session };
  } catch (error) {
    // 403 (inactive / no role) and 409 (e-mail in use) carry a useful message.
    if (error?.status === 403 || error?.status === 409)
      return { status: 'error', message: error.message };
    if (error?.status === 400)
      return { status: 'error', message: MESSAGES.incomplete };
    return { status: 'error', message: MESSAGES.failed };
  }
}
