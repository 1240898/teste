import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPlanningInputModule } from '../../../backend/src/modules/planning-inputs/index.js';
import { FixtureRegistry } from '../../../backend/src/modules/planning-inputs/infrastructure/FixtureRegistry.js';
import { MemoryInputRecords } from '../../../backend/src/modules/planning-inputs/infrastructure/InputRecords.js';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const express = require('express');
const root = fileURLToPath(new URL('../../../', import.meta.url));

export async function sourceServer({ mutate, source, records = new MemoryInputRecords(), intercept, viewOptions } = {}) {
  const fixtures = await FixtureRegistry.bundled();
  if (mutate) for (const dataset of fixtures.datasets.values()) mutate(dataset);
  const credentials = { readToken: randomBytes(32).toString('hex'), recordsToken: randomBytes(32).toString('hex') };
  const module = createPlanningInputModule({ fixtures, source, records, credentials, viewOptions });
  const app = express(), requests = [];
  app.use(express.json({ limit: '4mb' }));
  app.use((req, res, next) => {
    requests.push({ method: req.method, path: req.path, body: structuredClone(req.body) });
    if (intercept?.(req, res, next)) return;
    next();
  });
  app.use('/api/v1', module.router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  async function request(path, { method = 'GET', permission = 'read', body } = {}) {
    const result = await fetch(baseUrl + path, { method,
      headers: { Authorization: `Bearer ${permission === 'read' ? credentials.readToken : credentials.recordsToken}`,
        'Content-Type': 'application/json' }, ...(body && { body: JSON.stringify(body) }) });
    return { status: result.status, body: result.status === 204 ? null : await result.json() };
  }
  async function claim(selection) {
    const result = await request('/internal/planning/input-runs', { method: 'POST', permission: 'records', body: selection });
    if (result.status !== 200) throw new Error(JSON.stringify(result));
    return { ...selection, attemptNo: result.body.attemptNo };
  }
  async function load(execution, overrides = {}) {
    const child = spawn(process.argv[2] ?? process.env.SWIPL ?? 'swipl',
      ['-q', '-s', 'ai/demo_inputs.pl', '-g', 'demo_inputs', '-t', 'halt'], { cwd: root,
        env: { ...process.env, LAPRIZZA_INPUT_API_URL: baseUrl,
          LAPRIZZA_INPUT_READ_TOKEN: credentials.readToken, LAPRIZZA_INPUT_RECORDS_TOKEN: credentials.recordsToken, ...overrides },
        stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.stdin.end(JSON.stringify(execution));
    const timer = setTimeout(() => child.kill(), 15000);
    try {
      const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
      if (code !== 0) throw new Error(`Prolog failed (${code}): ${stderr}`);
      return JSON.parse(stdout);
    } finally { clearTimeout(timer); }
  }
  return { fixtures, module, requests, credentials, request, claim, load,
    async close() { await module.dispose(); await new Promise((resolve) => server.close(resolve)); } };
}

export function selection(id = 'five-medium', planning = false) {
  const version = id === 'iarti-demo' ? '2' : '1';
  return { executionId: randomUUID(), scenarioId: `test-${id}`, calculation: planning ? 'REQUIREMENTS_PLANNING' : 'BOM', mode: 'current',
    demand: { type: 'fixture', id, version }, catalogue: { type: 'saved', id, version }, stock: { type: 'saved', id, version },
    ...(planning && { supplierScenario: { id, version, type: 'fixture' }, referenceDate: '2026-11-20' }) };
}
