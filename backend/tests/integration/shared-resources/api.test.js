import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { request as sendRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createSharedResourcesModule } from '../../../src/modules/shared-resources/index.js';
import { publishDocument } from '../../../src/modules/shared-resources/documentStore.js';
import { AuthMiddleware } from '../../../src/modules/user-authentication-management/api/middlewares/authMiddleware.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createUser } from '../../helpers/createUser.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';

const base = '/api/v1/shared-resources';
const name = 'Restaurant procedures.txt';
const fileUrl = `${base}/${encodeURIComponent(name)}`;
const content = 'Example restaurant procedure.\n';
const security = {
  secret: 'sys04-fixture-secret-at-least-thirty-two-bytes',
  expiresIn: '5m',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};

let workspace,
  directory,
  app,
  repository,
  customer,
  token,
  userModule,
  sharedResourcesModule,
  auditPath,
  writeDocument,
  afterAuthentication;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'laprizza-shared-resources-'));
  directory = join(workspace, 'documents');
  auditPath = join(workspace, 'access.jsonl');
  await mkdir(directory);
  await writeFile(join(directory, name), content);

  repository = new MemoryUserRepository();
  userModule = createUserModule({ repository, security });
  customer = createUser({
    name: 'Customer Test',
    email: 'shared-resources@example.com',
    passwordHash: await userModule.hasher.hash('example-password'),
  });
  await repository.save(customer);
  token = userModule.tokens.generateToken({ sub: customer.getId().getValue() });
  writeDocument = publishDocument;
  afterAuthentication = undefined;
  const authMiddleware = new AuthMiddleware(userModule.userService);
  const verifyToken = authMiddleware.verifyToken;
  authMiddleware.verifyToken = (req, res, next) =>
    verifyToken(req, res, () => {
      next();
      afterAuthentication?.(req);
    });
  sharedResourcesModule = createSharedResourcesModule({
    authMiddleware,
    directory,
    auditPath,
    writeDocument: (...args) => writeDocument(...args),
  });
  app = createApp({ userModule, sharedResourcesModule });
});

afterEach(async () => {
  await sharedResourcesModule?.flushAudit();
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

test('an active customer can list and download the document', async () => {
  const headers = { Authorization: `Bearer ${token}` };
  await request(app)
    .get(base)
    .set(headers)
    .expect(200, { items: [{ name }] });

  const response = await request(app)
    .get(fileUrl)
    .set(headers)
    .expect('Cache-Control', 'no-store')
    .expect('Content-Disposition', `attachment; filename="${name}"`)
    .expect('Content-Type', 'application/octet-stream')
    .expect(200);
  expect(response.body.toString('utf8')).toBe(content);
});

test('both routes require authentication and reject the same session after deactivation', async () => {
  await request(app).get(base).expect(401);
  await request(app).get(fileUrl).expect(401);

  const headers = { Authorization: `Bearer ${token}` };
  await request(app).get(fileUrl).set(headers).expect(200);
  customer.deactivate();
  await repository.save(customer);
  await request(app).get(base).set(headers).expect(403);
  await request(app).get(fileUrl).set(headers).expect(403);
});

test('hidden files, folders and symbolic links are excluded from the list and download', async () => {
  await writeFile(join(directory, '.hidden.txt'), 'Hidden fixture');
  await writeFile(join(directory, 'backup.zip'), 'Excluded fixture');
  await mkdir(join(directory, 'folder'));
  const excluded = ['.hidden.txt', 'backup.zip', 'folder'];
  if (process.platform !== 'win32') {
    const otherFile = join(workspace, 'other.txt');
    await writeFile(otherFile, 'Separate fixture');
    await symlink(otherFile, join(directory, 'link.txt'));
    excluded.push('link.txt');
  }

  const headers = { Authorization: `Bearer ${token}` };
  await request(app)
    .get(base)
    .set(headers)
    .expect(200, { items: [{ name }] });
  for (const entry of excluded) {
    await request(app).get(`${base}/${entry}`).set(headers).expect(404);
  }
});

async function administrator() {
  const user = createUser({
    name: 'Administrator Test',
    email: 'shared-admin@example.com',
    passwordHash: customer.getPassword().getHash(),
    roles: ['ADMINISTRATOR', 'CUSTOMER'],
  });
  await repository.save(user);
  const accessToken = userModule.tokens.generateToken({
    sub: user.getId().getValue(),
  });
  return { user, headers: { Authorization: `Bearer ${accessToken}` } };
}

function upload(method, url, headers, value, confirmed = true) {
  const attempt = request(app)
    [method](url)
    .set(headers)
    .type('application/octet-stream');
  if (confirmed) attempt.set('X-Confirm-Shared-Publication', 'true');
  return attempt.send(Buffer.from(value));
}

async function readAudit() {
  await sharedResourcesModule.flushAudit();
  return (await readFile(auditPath, 'utf8')).trim().split('\n').map(JSON.parse);
}

function completionSignal() {
  let resolve;
  const promise = new Promise((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

test('only an administrator manages documents and revocation applies to the same session', async () => {
  const { user, headers } = await administrator();
  const reader = { Authorization: `Bearer ${token}` };
  const url = `${base}/example.txt`;
  await upload('post', url, {}, 'draft').expect(401);
  await upload('post', url, reader, 'draft').expect(403);
  await upload('put', fileUrl, reader, 'draft').expect(403);
  await request(app).delete(fileUrl).set(reader).expect(403);
  await upload('post', url, headers, 'draft', false).expect(400);
  await upload('post', `${base}/backup.zip`, headers, 'draft').expect(400);
  await upload('put', url, headers, 'first edition').expect(404);
  await upload('post', url, headers, 'first edition').expect(201, {
    name: 'example.txt',
  });
  await upload('post', url, headers, 'duplicate').expect(409);
  await upload('put', url, headers, 'second edition').expect(204);
  const download = await request(app).get(url).set(reader).expect(200);
  expect(download.body.toString('utf8')).toBe('second edition');
  await request(app).delete(url).set(headers).expect(204);
  await request(app).get(url).set(reader).expect(404);

  user.setRoles(['CUSTOMER']);
  await repository.save(user);
  await upload('post', url, headers, 'after revoke').expect(403);
  await upload('put', fileUrl, headers, 'after revoke').expect(403);
  await request(app).delete(fileUrl).set(headers).expect(403);
  await request(app).get(fileUrl).set(headers).expect(200);

  const records = await readAudit();
  expect(records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        operation: 'PUBLISH',
        outcome: 'DENIED',
        actorId: null,
        statusCode: 401,
      }),
      expect.objectContaining({
        operation: 'PUBLISH',
        outcome: 'SUCCESS',
        actorId: user.getId().getValue(),
        document: 'example.txt',
        statusCode: 201,
      }),
      expect.objectContaining({
        operation: 'REPLACE',
        outcome: 'SUCCESS',
        document: 'example.txt',
        statusCode: 204,
      }),
      expect.objectContaining({
        operation: 'DELETE',
        outcome: 'SUCCESS',
        document: 'example.txt',
        statusCode: 204,
      }),
      expect.objectContaining({
        operation: 'DELETE',
        outcome: 'DENIED',
        actorId: user.getId().getValue(),
        document: name,
        statusCode: 403,
      }),
      expect.objectContaining({
        operation: 'DOWNLOAD',
        outcome: 'SUCCESS',
        actorId: customer.getId().getValue(),
        document: 'example.txt',
        statusCode: 200,
      }),
    ]),
  );
});

test('a write waiting in the queue rechecks the role before touching the file', async () => {
  const { user, headers } = await administrator();
  const firstWriteStarted = completionSignal();
  const finishFirstWrite = completionSignal();
  const deleteQueued = completionSignal();

  writeDocument = async (...args) => {
    firstWriteStarted.resolve();
    await finishFirstWrite.promise;
    return publishDocument(...args);
  };
  afterAuthentication = (req) => {
    if (req.method === 'DELETE') deleteQueued.resolve();
  };

  const firstWrite = upload('post', `${base}/first.txt`, headers, 'first')
    .expect(201)
    .then((response) => response);
  let waitingDelete;
  try {
    await firstWriteStarted.promise;
    waitingDelete = request(app)
      .delete(fileUrl)
      .set(headers)
      .expect(403)
      .then((response) => response);
    await deleteQueued.promise;
    user.setRoles(['CUSTOMER']);
    await repository.save(user);
  } finally {
    finishFirstWrite.resolve();
    await Promise.all([firstWrite, waitingDelete]);
  }

  expect(await readFile(join(directory, name), 'utf8')).toBe(content);
  expect(await readAudit()).toContainEqual(
    expect.objectContaining({
      operation: 'DELETE',
      outcome: 'DENIED',
      resultSource: 'FILE_OPERATION',
      statusCode: 403,
      document: name,
    }),
  );
});

test('a successful publication is audited when the client disconnects during the write', async () => {
  const { user, headers } = await administrator();
  const started = completionSignal();
  const finishWrite = completionSignal();
  const responseClosed = completionSignal();
  const document = 'disconnected.txt';
  writeDocument = async (...args) => {
    started.resolve();
    await finishWrite.promise;
    return publishDocument(...args);
  };

  const server = app.listen(0, '127.0.0.1');
  server.once('request', (_req, res) =>
    res.once('close', responseClosed.resolve),
  );
  await once(server, 'listening');
  const client = sendRequest({
    hostname: '127.0.0.1',
    port: server.address().port,
    path: `${base}/${document}`,
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/octet-stream',
      'Content-Length': Buffer.byteLength(content),
      'X-Confirm-Shared-Publication': 'true',
    },
  });
  client.on('error', () => {});
  try {
    client.end(content);
    await started.promise;
    client.destroy();
    await responseClosed.promise;
    finishWrite.resolve();

    const events = (await readAudit()).filter(
      (event) => event.document === document,
    );
    expect(await readFile(join(directory, document), 'utf8')).toBe(content);
    expect(events).toEqual([
      expect.objectContaining({
        operation: 'PUBLISH',
        actorId: user.getId().getValue(),
        outcome: 'SUCCESS',
        resultSource: 'FILE_OPERATION',
        statusCode: 201,
      }),
    ]);
  } finally {
    finishWrite.resolve();
    client.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});
