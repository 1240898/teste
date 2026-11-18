import { jest } from '@jest/globals';
import { GoogleOidcProvider } from '../../../src/modules/user-authentication-management/infrastructure/security/GoogleOidcProvider.js';
import { ExternalIdentityClaims } from '../../../src/modules/user-authentication-management/application/dtos/ExternalIdentityClaims.js';
import { loadExternalIdentityConfig } from '../../../src/shared/security/config.js';

const config = {
  clientId: 'client-id.apps.googleusercontent.com',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:5173/auth/callback/google',
};
const payload = (overrides = {}) => ({
  iss: 'https://accounts.google.com',
  aud: config.clientId,
  sub: '109876543210987654321',
  email: 'ana.silva@gmail.com',
  email_verified: true,
  name: 'Ana Silva',
  nonce: 'expected-nonce',
  ...overrides,
});
// Test double of google-auth-library's OAuth2Client: no network access.
function fakeClient(tokenPayload = payload()) {
  return {
    generateCodeVerifierAsync: jest.fn().mockResolvedValue({
      codeVerifier: 'pkce-verifier',
      codeChallenge: 'pkce-challenge',
    }),
    generateAuthUrl: jest.fn((options) => {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      for (const [key, value] of Object.entries(options))
        url.searchParams.set(
          key,
          Array.isArray(value) ? value.join(' ') : value,
        );
      return url.toString();
    }),
    getToken: jest.fn().mockResolvedValue({
      tokens: { id_token: 'id.token.value', access_token: 'google-access' },
    }),
    verifyIdToken: jest
      .fn()
      .mockResolvedValue({ getPayload: () => tokenPayload }),
  };
}

describe('AA02 GoogleOidcProvider (UT14)', () => {
  test('builds an Authorization Code + PKCE (S256) request with state and nonce', async () => {
    const client = fakeClient();
    const provider = new GoogleOidcProvider(config, client);
    const first = await provider.createAuthorizationRequest();
    const second = await provider.createAuthorizationRequest();
    const url = new URL(first.authorizationUrl);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('code_challenge')).toBe('pkce-challenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe(first.state);
    expect(url.searchParams.get('nonce')).toBe(first.nonce);
    expect(first.codeVerifier).toBe('pkce-verifier');
    expect(url.searchParams.get('code_verifier')).toBeNull();
    expect(first.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.state).not.toBe(second.state);
    expect(first.nonce).not.toBe(second.nonce);
  });

  test('exchanges the code with the verifier and returns verified claims', async () => {
    const client = fakeClient();
    const provider = new GoogleOidcProvider(config, client);
    const claims = await provider.exchangeAndVerify(
      'auth-code',
      'pkce-verifier',
      'expected-nonce',
    );
    expect(client.getToken).toHaveBeenCalledWith({
      code: 'auth-code',
      codeVerifier: 'pkce-verifier',
      redirect_uri: config.redirectUri,
    });
    expect(client.verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id.token.value',
      audience: config.clientId,
    });
    expect(claims).toBeInstanceOf(ExternalIdentityClaims);
    expect(claims).toEqual({
      provider: 'GOOGLE',
      subject: '109876543210987654321',
      email: 'ana.silva@gmail.com',
      emailVerified: true,
      name: 'Ana Silva',
    });
    expect(JSON.stringify(claims)).not.toMatch(/google-access|id\.token/);
  });

  test.each([
    ['wrong audience', payload({ aud: 'other-client' })],
    ['wrong issuer', payload({ iss: 'https://evil.example.com' })],
    ['nonce mismatch', payload({ nonce: 'replayed-nonce' })],
    ['missing nonce', payload({ nonce: undefined })],
    ['unverified e-mail', payload({ email_verified: false })],
    ['string email_verified', payload({ email_verified: 'true' })],
    ['missing e-mail', payload({ email: undefined })],
    ['missing subject', payload({ sub: '' })],
  ])('rejects an ID token with %s', async (_name, tokenPayload) => {
    const provider = new GoogleOidcProvider(config, fakeClient(tokenPayload));
    await expect(
      provider.exchangeAndVerify(
        'auth-code',
        'pkce-verifier',
        'expected-nonce',
      ),
    ).rejects.toThrow();
  });

  test('rejects library failures with messages that contain no secrets', async () => {
    const exchangeFails = fakeClient();
    exchangeFails.getToken.mockRejectedValue(
      new Error('invalid_grant for code auth-code and secret client-secret'),
    );
    const signatureFails = fakeClient();
    signatureFails.verifyIdToken.mockRejectedValue(
      new Error('Invalid token signature: id.token.value'),
    );
    const noIdToken = fakeClient();
    noIdToken.getToken.mockResolvedValue({ tokens: { access_token: 'a' } });
    for (const [client, message] of [
      [exchangeFails, 'code exchange failed'],
      [signatureFails, 'invalid ID token'],
      [noIdToken, 'no ID token returned'],
    ]) {
      const error = await new GoogleOidcProvider(config, client)
        .exchangeAndVerify('auth-code', 'pkce-verifier', 'expected-nonce')
        .catch((e) => e);
      expect(error.message).toBe(message);
      expect(error.message).not.toMatch(/auth-code|client-secret|id\.token/);
    }
  });
});

describe('AA02 loadExternalIdentityConfig', () => {
  const env = {
    GOOGLE_CLIENT_ID: config.clientId,
    GOOGLE_CLIENT_SECRET: config.clientSecret,
    GOOGLE_REDIRECT_URI: config.redirectUri,
  };
  test('is disabled when no Google variable is set', () => {
    expect(loadExternalIdentityConfig({})).toBeNull();
    expect(
      loadExternalIdentityConfig({
        GOOGLE_CLIENT_ID: ' ',
        GOOGLE_CLIENT_SECRET: '',
        GOOGLE_REDIRECT_URI: '',
      }),
    ).toBeNull();
    // The default redirect URI alone (as in .env.example) does not enable it.
    expect(
      loadExternalIdentityConfig({ GOOGLE_REDIRECT_URI: config.redirectUri }),
    ).toBeNull();
  });
  test('returns the complete configuration', () => {
    expect(loadExternalIdentityConfig(env)).toEqual(config);
    expect(
      loadExternalIdentityConfig({
        ...env,
        GOOGLE_REDIRECT_URI:
          'https://laprizza.example.com/auth/callback/google',
      }).redirectUri,
    ).toBe('https://laprizza.example.com/auth/callback/google');
  });
  test.each([
    [{ ...env, GOOGLE_CLIENT_SECRET: ''  }],
    [{ ...env, GOOGLE_CLIENT_ID: '' }],
    [{ ...env, GOOGLE_REDIRECT_URI: '' }],
    [{ ...env, GOOGLE_REDIRECT_URI: 'not a url' }],
    [{ ...env, GOOGLE_REDIRECT_URI: 'http://laprizza.example.com/cb' }],
    [{ ...env, GOOGLE_REDIRECT_URI: 'http://localhost:5173/cb#x' }],
  ])('rejects an incomplete or unsafe configuration %#', (invalid) => {
    expect(() => loadExternalIdentityConfig(invalid)).toThrow();
  });
  test('errors never echo the client secret', () => {
    const error = (() => {
      try {
        loadExternalIdentityConfig({ ...env, GOOGLE_REDIRECT_URI: 'bad' });
      } catch (e) {
        return e;
      }
    })();
    expect(error.message).not.toContain(config.clientSecret);
  });
});