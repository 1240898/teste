import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { IdentityProvider } from '../../domain/model/values.js';
import { ExternalIdentityClaims } from '../../application/dtos/ExternalIdentityClaims.js';

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const SCOPES = ['openid', 'email', 'profile'];
const randomValue = () => randomBytes(32).toString('base64url');

/**
 * AA02 adapter for Google Identity Services (OpenID Connect on OAuth 2.0).
 * Authorization Code flow + PKCE (S256); the back end is the confidential client.
 * Error messages are safe to log: they never contain codes, tokens or secrets.
 */
export class GoogleOidcProvider {
  provider = IdentityProvider.GOOGLE;

  constructor(
    { clientId, clientSecret, redirectUri },
    client = new OAuth2Client({ clientId, clientSecret, redirectUri }),
  ) {
    Object.assign(this, { clientId, redirectUri, client });
  }

  async createAuthorizationRequest() {
    const state = randomValue();
    const nonce = randomValue();
    const { codeVerifier, codeChallenge } =
      await this.client.generateCodeVerifierAsync();
    const authorizationUrl = this.client.generateAuthUrl({
      access_type: 'online',
      response_type: 'code',
      scope: SCOPES,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return { authorizationUrl, state, nonce, codeVerifier };
  }

  async exchangeAndVerify(code, codeVerifier, nonce) {
    let idToken;
    try {
      const { tokens } = await this.client.getToken({
        code,
        codeVerifier,
        redirect_uri: this.redirectUri,
      });
      // Only the ID token is used; the Google access token is discarded (BR 16).
      idToken = tokens?.id_token;
    } catch {
      throw new Error('code exchange failed');
    }
    if (typeof idToken !== 'string' || !idToken)
      throw new Error('no ID token returned');

    let payload;
    try {
      // Verifies signature (Google JWKS), expiry, audience and issuer.
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new Error('invalid ID token');
    }
    if (
      !payload ||
      !GOOGLE_ISSUERS.includes(payload.iss) ||
      payload.aud !== this.clientId
    )
      throw new Error('invalid ID token');
    if (typeof nonce !== 'string' || payload.nonce !== nonce)
      throw new Error('nonce mismatch');
    if (typeof payload.sub !== 'string' || !payload.sub)
      throw new Error('missing subject');
    if (payload.email_verified !== true || typeof payload.email !== 'string')
      throw new Error('unverified e-mail');

    return new ExternalIdentityClaims({
      provider: this.provider,
      subject: payload.sub,
      email: payload.email,
      emailVerified: true,
      name: typeof payload.name === 'string' ? payload.name : '',
    });
  }
}