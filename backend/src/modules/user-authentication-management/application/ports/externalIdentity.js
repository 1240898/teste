/**
 * AA02 structural ports (adapters are injected; no runtime interface hierarchy).
 *
 * @typedef {Object} AuthorizationRequest
 * @property {string} authorizationUrl Provider URL the browser is redirected to.
 * @property {string} state Random CSRF value echoed back by the provider.
 * @property {string} nonce Random value bound to the ID token (replay protection).
 * @property {string} codeVerifier PKCE verifier; never leaves the back end.
 *
 * @typedef {Object} IExternalIdentityProvider
 * @property {string} provider IdentityProvider value handled by the adapter.
 * @property {() => AuthorizationRequest|Promise<AuthorizationRequest>} createAuthorizationRequest
 * @property {(code: string, codeVerifier: string, nonce: string) =>
 *   Promise<import('../dtos/ExternalIdentityClaims.js').ExternalIdentityClaims>} exchangeAndVerify
 *   Exchanges the authorization code and returns claims of a validated ID token
 *   (signature, iss, aud, exp, nonce and email_verified checked). Throws otherwise.
 *
 * @typedef {Object} PendingAuthorization
 * @property {string} provider
 * @property {string} nonce
 * @property {string} codeVerifier
 * @property {number} [expiresAt] Set by the store.
 *
 * @typedef {Object} IAuthorizationStateStore
 * @property {(state: string, pending: PendingAuthorization) => void} save
 * @property {(state: string) => PendingAuthorization|null} consume
 *   Single use: returns the entry once and removes it; expired entries return null.
 */
export {};