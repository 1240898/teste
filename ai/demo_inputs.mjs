import express from '../backend/node_modules/express/index.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPlanningInputModule } from '../backend/src/modules/planning-inputs/index.js';
import { FixtureRegistry } from '../backend/src/modules/planning-inputs/infrastructure/FixtureRegistry.js';
import { MemoryInputRecords } from '../backend/src/modules/planning-inputs/infrastructure/InputRecords.js';

// Local source API only, not an AI05 public endpoint. Every call uses fresh
// ephemeral credentials and the demo never connects to a database.
const fixtures = await FixtureRegistry.bundled();
const name = process.argv[2] ?? 'five-medium';
const planning = process.argv.includes('--planning');
const id = name === 'iarti' ? 'iarti-demo' : name;
const version = id === 'iarti-demo' ? '2' : '1';
const readToken = randomBytes(32).toString('hex');
const recordsToken = randomBytes(32).toString('hex');
const module = createPlanningInputModule({ fixtures, records: new MemoryInputRecords(),
  credentials: { readToken, recordsToken } });
const app = express();
if (process.argv.includes('--trace')) app.use((req, res, next) => {
  res.once('finish', () => console.error(`${req.method} ${req.path} -> ${res.statusCode}`)); next();
});
app.use(express.json({ limit: '4mb' })); app.use('/api/v1', module.router);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
try {
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const selection = { executionId: randomUUID(), scenarioId: `http-${id}`, mode: 'current',
    calculation: planning ? 'REQUIREMENTS_PLANNING' : 'BOM',
    demand: { type: 'fixture', id, version }, catalogue: { type: 'saved', id, version },
    stock: { type: 'saved', id, version },
    ...(planning && { supplierScenario: { id, version, type: 'fixture' }, referenceDate: '2026-11-20' }) };
  const claim = await fetch(`${baseUrl}/internal/planning/input-runs`, { method: 'POST',
    headers: { Authorization: `Bearer ${recordsToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(selection) });
  const context = await claim.json();
  if (!claim.ok) throw new Error(JSON.stringify(context));
  const execution = { ...selection, attemptNo: context.attemptNo };
  const child = spawn(process.env.SWIPL ?? 'swipl', ['-q', '-s', 'ai/demo_inputs.pl', '-g', 'demo_inputs', '-t', 'halt'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, LAPRIZZA_INPUT_API_URL: baseUrl,
      LAPRIZZA_INPUT_READ_TOKEN: readToken, LAPRIZZA_INPUT_RECORDS_TOKEN: recordsToken },
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  child.stdin.end(JSON.stringify(execution));
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  process.exitCode = code ?? 1;
} finally {
  await module.dispose(); await new Promise((resolve) => server.close(resolve));
}
