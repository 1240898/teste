import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createPlanningInputModule } from '../../../src/modules/planning-inputs/index.js';
import { FixtureRegistry } from '../../../src/modules/planning-inputs/infrastructure/FixtureRegistry.js';
import { MemoryInputRecords } from '../../../src/modules/planning-inputs/infrastructure/InputRecords.js';

const credentials = { readToken: 'test-reader-'.repeat(4), recordsToken: 'test-records-'.repeat(4) };
const auth = (token = credentials.readToken) => ({ Authorization: `Bearer ${token}` });
const selection = () => ({ executionId: randomUUID(), scenarioId: 'api-test', calculation: 'BOM', mode: 'current',
  demand: { type: 'fixture', id: 'five-medium', version: '1' },
  catalogue: { type: 'saved', id: 'five-medium', version: '1' }, stock: { type: 'saved', id: 'five-medium', version: '1' } });
let app, module;
beforeEach(async () => {
  module = createPlanningInputModule({ fixtures: await FixtureRegistry.bundled(), credentials, records: new MemoryInputRecords() });
  app = createApp({ planningInputModule: module });
});
afterEach(async () => module.dispose());

test('service routes reject missing credentials and Manager-style user bearers', async () => {
  for (const headers of [{}, auth('a-user-session-bearer')])
    await request(app).post('/api/v1/internal/planning/read-views').set(headers).send(selection()).expect(401);
});
test('reader and records permissions are separate', async () => {
  await request(app).post('/api/v1/internal/planning/input-runs').set(auth()).send(selection()).expect(403);
  await request(app).post('/api/v1/internal/planning/read-views').set(auth(credentials.recordsToken)).send(selection()).expect(403);
});
test('the initial call accepts selectors, not a complete business dataset', async () => {
  await request(app).post('/api/v1/internal/planning/read-views').set(auth())
    .send({ ...selection(), products: [{ productId: 'injected' }] }).expect(400);
});
test('fresh operational forecasts cannot use saved eligibility with simulated stock', async () => {
  const picked = { ...selection(), demand: { type: 'forecast', id: 'forecast-1', version: '1' } };
  await request(app).post('/api/v1/internal/planning/input-runs').set(auth(credentials.recordsToken)).send(picked).expect(400);
});
test('a coherent view supplies requested product records only', async () => {
  const opened = await request(app).post('/api/v1/internal/planning/read-views').set(auth()).send(selection()).expect(200);
  expect(opened.body.products).toBeUndefined();
  const reply = await request(app).post(`/api/v1/internal/planning/read-views/${opened.body.viewId}/products`)
    .set(auth()).send({ productIds: ['PROD-90003'] }).expect(200);
  expect(reply.body.revision).toBe(opened.body.revision);
  expect(reply.body.items.map((x) => x.productId)).toEqual(['PROD-90003']);
  await request(app).delete(`/api/v1/internal/planning/read-views/${opened.body.viewId}`).set(auth()).expect(204);
  await request(app).post(`/api/v1/internal/planning/read-views/${opened.body.viewId}/products`)
    .set(auth()).send({ productIds: [] }).expect(409);
});
test('execution identity cannot change selectors and input snapshots never overwrite a winner', async () => {
  const picked = selection();
  const claim = await request(app).post('/api/v1/internal/planning/input-runs').set(auth(credentials.recordsToken)).send(picked).expect(200);
  await request(app).post('/api/v1/internal/planning/input-runs').set(auth(credentials.recordsToken))
    .send({ ...picked, scenarioId: 'different' }).expect(409);
  const endpoint = `/api/v1/internal/planning/input-runs/${picked.executionId}/inputs`;
  await request(app).get(endpoint).set(auth()).expect(409);
  const first = await request(app).put(endpoint).set(auth(credentials.recordsToken))
    .send({ attemptNo: claim.body.attemptNo, document: { schemaVersion: 1, selection: picked, marker: 'winner' } }).expect(200);
  const second = await request(app).put(endpoint).set(auth(credentials.recordsToken))
    .send({ attemptNo: claim.body.attemptNo, document: { schemaVersion: 1, selection: picked, marker: 'late' } }).expect(200);
  expect(second.body.snapshot).toEqual(first.body.snapshot);
  expect(second.body.snapshot.document.marker).toBe('winner');
});
test('a historical input run requires its original snapshot', async () => {
  await request(app).post('/api/v1/internal/planning/input-runs').set(auth(credentials.recordsToken))
    .send({ ...selection(), mode: 'historicalReplay', replayedFrom: randomUUID() }).expect(422);
});
test('source failure is explicit and does not switch to a fixture', async () => {
  const picked = { ...selection(), catalogue: { type: 'current' }, stock: { type: 'current' } };
  const reply = await request(app).post('/api/v1/internal/planning/read-views').set(auth()).send(picked).expect(503);
  expect(reply.body.error.code).toBe('INPUT_SOURCE_UNAVAILABLE');
});
test('private routes have a documented service security contract', async () => {
  const { openApiSpec } = await import('../../../src/shared/openapi/spec.js');
  expect(openApiSpec.paths['/internal/planning/read-views'].post.security).toEqual([{ planningServiceRead: [] }]);
  expect(openApiSpec.paths['/internal/planning/input-runs'].post.security).toEqual([{ planningRecordsWrite: [] }]);
});
