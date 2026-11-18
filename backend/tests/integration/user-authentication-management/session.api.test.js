import express from 'express';
import request from 'supertest';
import { AuthController } from '../../../src/modules/user-authentication-management/api/controllers/authController.js';
import { AuthRoutes } from '../../../src/modules/user-authentication-management/api/routes/authRoutes.js';
import { AuthMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/authMiddleware.js';
import { UserService } from '../../../src/modules/user-authentication-management/application/services/UserService.js';
import { JwtTokenService } from '../../../src/modules/user-authentication-management/infrastructure/security/JwtTokenService.js';
import { SessionCredentialService } from '../../../src/modules/user-authentication-management/infrastructure/security/SessionCredentialService.js';
import { InMemoryApplicationSessionRepository } from '../../../src/modules/user-authentication-management/infrastructure/security/InMemoryApplicationSessionRepository.js';
import { User } from '../../../src/modules/user-authentication-management/domain/model/User.js';
import {
  Email,
  UserId,
  UserName,
  Password,
  MarketingConsent,
} from '../../../src/modules/user-authentication-management/domain/model/values.js';
import { errorHandler } from '../../../src/shared/errors/errorHandler.js';
import { RoleMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/roleMiddleware.js';

const config = {
  idleTimeoutSeconds: 600,
  activityReportIntervalSeconds: 30,
  sessionRetentionSeconds: 604800,
  accessTokenTtl: '5m',
  cookieSecure: false,
  allowedOrigin: 'http://localhost:5173',
};
const secret = 'integration-test-secret-at-least-thirty-two-bytes';

function build() {
  const user = User.create(
    UserId.create('USR-00001'),
    UserName.create('Ana'),
    Email.create('ana@example.com'),
    Password.createFromHash('$2b$10$' + 'a'.repeat(53)),
    MarketingConsent.create(false),
  );
  user.setRoles(['MANAGER']);
  const repository = {
    async findByEmail() {
      return user;
    },
    async findById() {
      return user;
    },
  };
  const hasher = {
    async compare() {
      return true;
    },
  };
  const tokens = new JwtTokenService({
    secret,
    expiresIn: '5m',
    issuer: 'laprizza',
    audience: 'laprizza-api',
  });
  const sessions = new InMemoryApplicationSessionRepository();
  const credentials = new SessionCredentialService();
  const service = new UserService(
    repository,
    hasher,
    tokens,
    null,
    sessions,
    credentials,
    config,
  );
  const auth = new AuthController(service, null, config);
  const router = new AuthRoutes(
    auth,
    (_req, _res, next) => next(),
    new AuthMiddleware(service),
  ).setupRoutes();
  router.get(
    '/protected',
    new AuthMiddleware(service).verifyToken,
    (req, res) => res.json({ userId: req.user.sub }),
  );
  router.get(
    '/manager-only',
    new AuthMiddleware(service).verifyToken,
    RoleMiddleware.requireRole('ADMINISTRATOR'),
    (_req, res) => res.json({ ok: true }),
  );
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/v1', router);
  app.use(errorHandler);
  return app;
}

describe('AA04 session API', () => {
  test('sets HttpOnly renewal cookie, renews with CSRF header, and prevents token reuse after logout', async () => {
    const app = build();
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'password' });
    expect(login.status).toBe(200);
    expect(login.headers['cache-control']).toBe('no-store');
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(login.body.sessionCredential).toBeUndefined();
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const csrf = login.body.csrfToken;
    const before = await request(app)
      .get('/api/v1/protected')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(before.status).toBe(200);
    const resumed = await request(app)
      .post('/api/v1/auth/resume')
      .set('Origin', config.allowedOrigin)
      .set('Cookie', cookie);
    expect(resumed.status).toBe(200);
    expect(resumed.body.accessToken).not.toBe(login.body.accessToken);
    expect(resumed.body.csrfToken).toBe(csrf);
    expect(resumed.body.idleExpiresAt).toBe(login.body.idleExpiresAt);
    expect(
      (
        await request(app)
          .get('/api/v1/manager-only')
          .set('Authorization', `Bearer ${resumed.body.accessToken}`)
      ).status,
    ).toBe(403);
    const renewal = await request(app)
      .post('/api/v1/auth/renew')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf);
    expect(renewal.status).toBe(200);
    expect(renewal.body.csrfToken).not.toBe(csrf);
    expect(renewal.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    const renewedCookie = renewal.headers['set-cookie'][0].split(';')[0];
    expect(
      (
        await request(app)
          .post('/api/v1/auth/renew')
          .set('Cookie', cookie)
          .set('X-CSRF-Token', csrf)
      ).status,
    ).toBe(401);
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', renewedCookie)
      .set('X-CSRF-Token', renewal.body.csrfToken);
    expect(logout.status).toBe(204);
    const after = await request(app)
      .get('/api/v1/protected')
      .set('Authorization', `Bearer ${renewal.body.accessToken}`);
    expect(after.status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/resume')
          .set('Origin', config.allowedOrigin)
          .set('Cookie', renewedCookie)
      ).status,
    ).toBe(401);
  });

  test('recovers from stale CSRF after another tab renews and keeps another device active', async () => {
    const app = build();
    const firstLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'password' });
    const otherDevice = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'password' });
    const oldCookie = firstLogin.headers['set-cookie'][0].split(';')[0];
    const staleCsrf = firstLogin.body.csrfToken;

    const renewed = await request(app)
      .post('/api/v1/auth/renew')
      .set('Cookie', oldCookie)
      .set('X-CSRF-Token', staleCsrf);
    const currentCookie = renewed.headers['set-cookie'][0].split(';')[0];

    expect(
      (
        await request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', currentCookie)
          .set('X-CSRF-Token', staleCsrf)
      ).status,
    ).toBe(401);

    const resumed = await request(app)
      .post('/api/v1/auth/resume')
      .set('Origin', config.allowedOrigin)
      .set('Cookie', currentCookie);
    expect(resumed.status).toBe(200);
    expect(resumed.body.csrfToken).toBe(renewed.body.csrfToken);

    expect(
      (
        await request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', currentCookie)
          .set('X-CSRF-Token', resumed.body.csrfToken)
      ).status,
    ).toBe(204);

    expect(
      (
        await request(app)
          .get('/api/v1/protected')
          .set('Authorization', `Bearer ${otherDevice.body.accessToken}`)
      ).status,
    ).toBe(200);
  });

  test('logout invalidates only its device session', async () => {
    const app = build();
    const deviceA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'password' });
    const deviceB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'password' });

    expect(
      (
        await request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', deviceA.headers['set-cookie'][0].split(';')[0])
          .set('X-CSRF-Token', deviceA.body.csrfToken)
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .get('/api/v1/protected')
          .set('Authorization', `Bearer ${deviceA.body.accessToken}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/v1/protected')
          .set('Authorization', `Bearer ${deviceB.body.accessToken}`)
      ).status,
    ).toBe(200);
  });

  test('rejects session resume from an untrusted origin', async () => {
    const app = build();
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'password' });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    expect(
      (
        await request(app)
          .post('/api/v1/auth/resume')
          .set('Origin', 'https://attacker.example')
          .set('Cookie', cookie)
      ).status,
    ).toBe(403);
  });
});
