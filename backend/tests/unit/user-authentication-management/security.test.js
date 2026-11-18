import { BcryptPasswordHasher } from '../../../src/modules/user-authentication-management/infrastructure/security/BcryptPasswordHasher.js';
import { JwtTokenService } from '../../../src/modules/user-authentication-management/infrastructure/security/JwtTokenService.js';
import { loadSecurityConfig } from '../../../src/shared/security/config.js';
import jwt from 'jsonwebtoken';

const secret = 'test-only-secret-with-at-least-32-bytes';
const settings = {
  secret,
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const id = 'USR-00001';
describe('security adapters', () => {
  test('salts passwords independently and verifies the original only', async () => {
    const hasher = new BcryptPasswordHasher();
    const first = await hasher.hash('long-password');
    const second = await hasher.hash('long-password');
    expect(first).not.toBe(second);
    expect(first).not.toContain('long-password');
    expect(await hasher.compare('long-password', first)).toBe(true);
    expect(await hasher.compare('wrong-password', first)).toBe(false);
    await expect(hasher.hash('é'.repeat(37))).rejects.toThrow();
  });
  test('issues the diagram claims and validates their signature and context', () => {
    const tokens = new JwtTokenService(settings);
    const token = tokens.generateToken({
      sub: id,
      sid: 'b4263208-f141-4e80-9313-8f3f145ba8aa',
    });
    expect(tokens.verifyToken(token).sub).toBe(id);
    expect(tokens.verifyToken(token).sid).toBe('b4263208-f141-4e80-9313-8f3f145ba8aa');
    expect(() => tokens.verifyToken(token + 'tampered')).toThrow();
  });
  test.each([
    { expiresIn: -1 },
    { issuer: 'other' },
    { audience: 'other' },
    { algorithm: 'HS384' },
  ])('rejects invalid token claims/algorithm %p', (override) => {
    const token = jwt.sign({ sub: id }, secret, {
      algorithm: 'HS256',
      issuer: settings.issuer,
      audience: settings.audience,
      expiresIn: '1d',
      ...override,
    });
    expect(() => new JwtTokenService(settings).verifyToken(token)).toThrow();
  });
  test('rejects unsigned tokens and tokens without expiry', () => {
    const tokens = new JwtTokenService(settings);
    expect(() =>
      tokens.verifyToken(jwt.sign({ sub: id }, '', { algorithm: 'none' })),
    ).toThrow();
    expect(() =>
      tokens.verifyToken(
        jwt.sign({ sub: id }, secret, {
          issuer: settings.issuer,
          audience: settings.audience,
        }),
      ),
    ).toThrow();
  });
  test('requires an explicit strong secret and bounded expiry', () => {
    expect(() => loadSecurityConfig({})).toThrow();
    expect(() => loadSecurityConfig({ JWT_SECRET: 'short' })).toThrow();
    expect(() =>
      loadSecurityConfig({ JWT_SECRET: secret, JWT_EXPIRES_IN: 'never' }),
    ).toThrow();
    expect(() =>
      loadSecurityConfig({ JWT_SECRET: secret, JWT_EXPIRES_IN: '999d' }),
    ).toThrow();
    expect(loadSecurityConfig({ JWT_SECRET: secret })).toMatchObject(settings);
  });
});
