import '../../../src/shared/config/index.js';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { bootstrapAdministrator } from '../../../src/modules/user-authentication-management/infrastructure/bootstrapAdministrator.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';

const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const password = 'Activation-Test42!';
const prefix = '/api/v1/users';
const signIn = '/api/v1/auth';
const unavailable = 'This invitation can no longer be used.';
const security = {
  secret: 'activation-integration-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};

describeDB('AA07 activation with PostgreSQL', () => {
  let database, api, replica, administrator, failedDeliveryRecipient;
  const delivered = new Map();
  const claims = new Map();
  const provider = {
    provider: 'GOOGLE',
    createAuthorizationRequest() {
      const state = randomBytes(24).toString('base64url');
      return {
        state,
        nonce: 'nonce',
        codeVerifier: 'verifier',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      };
    },
    exchangeAndVerify(code) {
      const identity = claims.get(code);
      if (!identity) throw new Error('Provider verification failed');
      return { provider: 'GOOGLE', emailVerified: true, ...identity };
    },
  };
  const testLogger = { warn: jest.fn() };
  const authorization = () => ({ Authorization: `Bearer ${administrator}` });
  const activation = (path, body, client = api) =>
    client.post(`${prefix}/activation/${path}`).send(body);
  const activateLocal = (token, candidate) =>
    activation('local', { token, password: candidate });
  const register = (email, marketingConsent = false) =>
    api
      .post(`${prefix}/register`)
      .send({
        name: 'Recipient',
        email,
        password,
        marketingConsent,
        phoneNumber: '+351912345678',
      });
  const invite = (email, activationMethod) =>
    api
      .post(`${prefix}/invitations`)
      .set(authorization())
      .send({ name: 'Worker', email, role: 'EMPLOYEE', activationMethod });
  const login = (email, candidate = password) =>
    api.post(`${signIn}/login`).send({ email, password: candidate });
  const currentRow = async (id) =>
    (
      await database.query(
        'SELECT active, ever_activated, password_hash, roles, marketing_consent_given FROM users WHERE id = $1',
        [id],
      )
    ).rows[0];
  const currentInvitation = async (id) =>
    (
      await database.query(
        'SELECT status, activation_method FROM activation_invitations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [id],
      )
    ).rows[0];

  beforeAll(async () => {
    database = await isolatedDatabase();
    await migrate(database);
    const admin = await bootstrapAdministrator(database, {
      name: 'Administrator',
      email: 'activation-admin@example.test',
      password,
    });
    const invitationDelivery = {
      async sendInvitation(recipient, address) {
        if (recipient === failedDeliveryRecipient)
          throw new Error('SMTP unavailable');
        delivered.set(
          recipient,
          new URL(address).searchParams.get('activationToken'),
        );
      },
    };
    const config = {
      database,
      security,
      identityProvider: provider,
      logger: testLogger,
      invitationDelivery,
      rateLimit: { limit: 100 },
    };
    const main = createUserModule(config);
    api = request(createApp({ userModule: main }));
    replica = request(createApp({ userModule: createUserModule(config) }));
    administrator = main.tokens.generateToken({ sub: admin.id });
  });

  afterAll(async () => database?.close());

  it('confirms a local registration without replacing credentials, roles or consent, then allows normal sign-in', async () => {
    const email = 'activation-self@example.test';
    const {
      body: { id },
    } = await register(email, true).expect(201);
    const token = delivered.get(email);
    const before = await currentRow(id);
    await login(email).expect(403);
    await activation('inspect', { token }).expect(200, { method: 'LOCAL' });
    await activation('external/start', { token }).expect(400);
    await activateLocal(token, password).expect(409);
    expect(await currentInvitation(id)).toEqual({
      status: 'PENDING',
      activation_method: 'LOCAL',
    });
    const confirmed = await activateLocal(token)
      .expect('Cache-Control', 'no-store')
      .expect(200, { nextSignIn: 'LOCAL' });
    expect(confirmed.headers['set-cookie']).toBeUndefined();
    expect(await currentRow(id)).toEqual({
      ...before,
      active: true,
      ever_activated: true,
    });
    expect(await currentInvitation(id)).toMatchObject({ status: 'USED' });
    await activateLocal(token).expect(400, {
      error: { status: 400, message: unavailable },
    });
    await login(email).expect(200);
  });

  it('sets the first local password and accepts only one concurrent redemption', async () => {
    const email = 'activation-worker@example.test';
    const {
      body: {
        user: { id },
      },
    } = await invite(email, 'LOCAL').expect(201);
    const token = delivered.get(email);
    await activateLocal(token).expect(400, {
      error: {
        status: 400,
        message: 'Password is required to activate this account.',
      },
    });
    await activateLocal(token, 'invalid').expect(400);
    expect(await currentRow(id)).toMatchObject({
      active: false,
      password_hash: null,
      roles: ['CUSTOMER', 'EMPLOYEE'],
    });
    expect(await currentInvitation(id)).toMatchObject({ status: 'PENDING' });
    const outcomes = await Promise.all([
      activateLocal(token, password),
      activateLocal(token, password),
    ]);
    expect(outcomes.map(({ status }) => status).sort()).toEqual([200, 400]);
    expect(await currentInvitation(id)).toMatchObject({ status: 'USED' });
    await login(email).expect(200);
  });

  it('rejects unknown, replaced, expired and wrongly addressed invitations', async () => {
    const email = 'activation-stale@example.test';
    const {
      body: { id },
    } = await register(email).expect(201);
    const token = delivered.get(email);
    await activation('inspect', { token: 'x'.repeat(43) }).expect(400);
    await api
      .post(`${prefix}/${id}/activation-invitations`)
      .set(authorization())
      .send({})
      .expect(200);
    await activateLocal(token).expect(400);
    const replacement = delivered.get(email);
    await database.query(
      "UPDATE activation_invitations SET intended_email = 'another@example.test' WHERE user_id = $1 AND status = 'PENDING'",
      [id],
    );
    await activateLocal(replacement).expect(400);
    await database.query(
      "UPDATE activation_invitations SET intended_email = $2, expires_at = clock_timestamp() - interval '1 second' WHERE user_id = $1 AND status = 'PENDING'",
      [id, email],
    );
    await activateLocal(replacement).expect(400);
    expect(await currentRow(id)).toMatchObject({
      active: false,
      ever_activated: false,
    });
  });

  it('checks the verified Google recipient, separates OAuth purposes and accepts the right callback on another API instance', async () => {
    const email = 'activation-google@example.test';
    const {
      body: {
        user: { id },
      },
    } = await invite(email, 'EXTERNAL').expect(201);
    const token = delivered.get(email);
    await activateLocal(token).expect(400);
    const start = () => activation('external/start', { token }).expect(200);
    const finish = (code, state) =>
      activation('external/complete', { code, state }, replica);
    const wrong = (await start()).body.state;
    claims.set('wrong', {
      email: 'wrong@example.test',
      subject: 'wrong-subject',
    });
    await finish('wrong', wrong).expect(401);
    await finish('missing-provider-proof', (await start()).body.state).expect(
      401,
    );
    await finish('wrong', (await start()).body.state.replace(/^./, '!')).expect(
      400,
    );
    expect(await currentInvitation(id)).toMatchObject({ status: 'PENDING' });

    claims.set('right', {
      email: email.toUpperCase(),
      subject: 'worker-subject',
    });
    const {
      body: { state: loginState },
    } = await api.post(`${signIn}/google/authorization`).expect(200);
    await finish('right', loginState).expect(401);
    const state = (await start()).body.state;
    await api
      .post(`${signIn}/google/callback`)
      .send({ code: 'right', state })
      .expect(401);
    const result = await finish('right', state).expect(200);
    expect(result.body).toMatchObject({
      status: 'SIGNED_IN',
      auth: {
        user: { id, roles: ['CUSTOMER', 'EMPLOYEE'], marketingConsent: false },
        hasLocalCredential: false,
      },
    });
    expect(result.body.auth.sessionCredential).toBeUndefined();
    expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
    await finish('right', state).expect(401);
    expect(await currentInvitation(id)).toMatchObject({ status: 'USED' });
    expect(
      (
        await database.query(
          'SELECT subject FROM user_external_identities WHERE user_id = $1',
          [id],
        )
      ).rows,
    ).toEqual([{ subject: 'worker-subject' }]);
  });

  it('keeps activation committed when an active user is ineligible for a session', async () => {
    const email = 'activation-roleless@example.test';
    const {
      body: {
        user: { id },
      },
    } = await invite(email, 'EXTERNAL').expect(201);
    await api
      .patch(`${prefix}/${id}/roles`)
      .set(authorization())
      .send({ roles: [] })
      .expect(200);
    claims.set('roleless', { email, subject: 'roleless-subject' });
    const {
      body: { state },
    } = await activation('external/start', {
      token: delivered.get(email),
    }).expect(200);
    const activated = await activation('external/complete', {
      code: 'roleless',
      state,
    }).expect(200, { status: 'ACTIVATED', nextSignIn: 'EXTERNAL' });
    expect(activated.headers['set-cookie']).toBeUndefined();
    expect(await currentRow(id)).toMatchObject({
      active: true,
      ever_activated: true,
      roles: [],
    });
    expect(await currentInvitation(id)).toMatchObject({ status: 'USED' });
    const {
      body: { state: normal },
    } = await api.post(`${signIn}/google/authorization`).expect(200);
    await api
      .post(`${signIn}/google/callback`)
      .send({ state: normal, code: 'roleless' })
      .expect(403);
  });

  it('rolls back conflicting external identity linkage and rejects a replacement made during Google authorization', async () => {
    const owner = 'google-owner@example.test';
    claims.set('owner', { email: owner, subject: 'already-linked-subject' });
    const {
      body: { state: ownerState },
    } = await api.post(`${signIn}/google/authorization`).expect(200);
    await api
      .post(`${signIn}/google/callback`)
      .send({ code: 'owner', state: ownerState })
      .expect(200);
    const email = 'google-conflict@example.test';
    const {
      body: {
        user: { id },
      },
    } = await invite(email, 'EXTERNAL').expect(201);
    const original = delivered.get(email);
    const {
      body: { state: stale },
    } = await activation('external/start', { token: original }).expect(200);
    await api
      .post(`${prefix}/${id}/activation-invitations`)
      .set(authorization())
      .send({})
      .expect(200);
    claims.set('other', { email, subject: 'already-linked-subject' });
    await activation('external/complete', {
      code: 'other',
      state: stale,
    }).expect(400);
    const {
      body: { state },
    } = await activation('external/start', {
      token: delivered.get(email),
    }).expect(200);
    await activation('external/complete', { code: 'other', state }).expect(409);
    expect(await currentRow(id)).toMatchObject({
      active: false,
      ever_activated: false,
    });
    expect(await currentInvitation(id)).toEqual({
      status: 'PENDING',
      activation_method: 'EXTERNAL',
    });
  });

  it('returns the persisted method when the replacement email fails and reuses it on retry', async () => {
    const email = 'activation-retry@example.test';
    const {
      body: {
        user: { id },
      },
    } = await invite(email, 'EXTERNAL').expect(201);
    await database.query(
      'UPDATE activation_invitations SET activation_method = NULL WHERE user_id = $1',
      [id],
    );
    const replace = (body) =>
      api
        .post(`${prefix}/${id}/activation-invitations`)
        .set(authorization())
        .send(body);
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
    failedDeliveryRecipient = email;
    try {
      const failed = await replace({ activationMethod: 'EXTERNAL' }).expect(
        200,
      );
      expect(failed.body).toMatchObject({
        deliveryStatus: 'FAILED',
        retryable: true,
        activationMethod: 'EXTERNAL',
      });
      expect(await currentInvitation(id)).toEqual({
        status: 'PENDING',
        activation_method: 'EXTERNAL',
      });
      await replace({ activationMethod: 'LOCAL' }).expect(409);
    } finally {
      failedDeliveryRecipient = undefined;
      logError.mockRestore();
    }
    const retried = await replace({}).expect(200);
    expect(retried.body).toMatchObject({
      deliveryStatus: 'SENT',
      activationMethod: 'EXTERNAL',
    });
  });
});

describeDB('AA06 invitation migration compatibility', () => {
  it('repairs an unknown invitation after the original 0025 and preserves methods on invitations created later', async () => {
    const database = await isolatedDatabase();
    const directory = await mkdtemp(join(tmpdir(), 'aa07-migration-'));
    const prior = pathToFileURL(directory + sep);
    const current = new URL('../../../migrations/', import.meta.url);
    const migration = '0025_activation_invitation_method.sql';
    const passwordHash = '$2b$10$' + 'a'.repeat(53);
    try {
      const migrations = (await readdir(current)).filter((name) =>
        name.endsWith('.sql'),
      );
      for (const name of migrations) {
        if (name < migration)
          await copyFile(new URL(name, current), new URL(name, prior));
      }
      await migrate(database, prior);
      for (const [id, hash] of [
        ['USR-90001', null],
        ['USR-90002', passwordHash],
        ['USR-90003', null],
      ]) {
        await database.query(
          `INSERT INTO users (id, name, email, password_hash, roles, active, ever_activated, marketing_consent_given, marketing_consent_timestamp)
          VALUES ($1, 'Legacy', $2, $3, ARRAY['CUSTOMER'], false, false, false, now())`,
          [id, `${id.toLowerCase()}@example.test`, hash],
        );
      }
      await database.query(
        `INSERT INTO activation_invitations (token_hash, user_id, intended_email, expires_at, status, created_at)
        VALUES ($1, 'USR-90001', 'usr-90001@example.test', now() + interval '1 day', 'PENDING', now() - interval '1 hour'),
               ($2, 'USR-90002', 'usr-90002@example.test', now() + interval '1 day', 'PENDING', now() - interval '1 hour')`,
        [Buffer.alloc(32, 1), Buffer.alloc(32, 2)],
      );
      await writeFile(
        new URL(migration, prior),
        `ALTER TABLE activation_invitations
  ADD COLUMN activation_method TEXT;

-- Before this migration, AA06 only issued invitations for public local
-- registrations, so the provenance of the existing invitation rows is known.
UPDATE activation_invitations
SET activation_method = 'LOCAL'
WHERE activation_method IS NULL;

ALTER TABLE activation_invitations
  ADD CONSTRAINT activation_invitations_method_valid
  CHECK (activation_method IS NULL OR activation_method IN ('LOCAL', 'EXTERNAL'));
`,
      );
      await migrate(database, prior);
      await database.query(
        `INSERT INTO activation_invitations (token_hash, user_id, intended_email, expires_at, status, activation_method, created_at)
        VALUES ($1, 'USR-90003', 'usr-90003@example.test', now() + interval '1 day', 'PENDING', 'LOCAL', now() + interval '1 second')`,
        [Buffer.alloc(32, 3)],
      );
      expect(await migrate(database)).toBe(
        migrations.filter((name) => name > migration).length,
      );
      const { rows } = await database.query(
        'SELECT activation_method FROM activation_invitations ORDER BY user_id',
      );
      expect(rows.map(({ activation_method }) => activation_method)).toEqual([
        null,
        'LOCAL',
        'LOCAL',
      ]);
      expect(await migrate(database)).toBe(0);
    } finally {
      await database.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
