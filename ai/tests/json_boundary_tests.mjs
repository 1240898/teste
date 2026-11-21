import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Optional first argument selects a portable SWI-Prolog executable.
const swipl = process.argv[2] ?? 'swipl';
const root = fileURLToPath(new URL('../../', import.meta.url));

function readJson(goal, source = 'ai/demo_bom.pl') {
  const result = spawnSync(swipl, ['-q', '-s', source, '-g', goal, '-t', 'halt'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  // This parser is the boundary that rounded the quantity reported in review.
  return JSON.parse(result.stdout);
}

for (const value of ['0', '9007199254740991', '-9007199254740991']) {
  test(`safe integer ${value} survives Prolog JSON -> JavaScript -> JSON`, () => {
    const response = readJson(`json_boundary:write_planning_json(current_output, _{lines:[_{requiredUnits: ${value}}]})`);
    const restored = JSON.parse(JSON.stringify(response));
    assert(Number.isSafeInteger(restored.lines[0].requiredUnits));
    assert.equal(BigInt(restored.lines[0].requiredUnits), BigInt(value));
  });
}

for (const value of ['9007199254740992', '9007199254740993', '-9007199254740992', '-9007199254740993']) {
  test(`unsafe integer ${value} produces an exact diagnostic`, () => {
    const response = readJson(`json_boundary:write_planning_json(current_output, _{lines:[_{requiredUnits: ${value}}]})`);
    assert.deepEqual(Object.keys(response), ['error']);
    assert.equal(response.error.code, 'JSON_INTEGER_OUT_OF_RANGE');
    assert.equal(response.error.field, '$.lines[0].requiredUnits');
    assert.equal(response.error.value, value);
    assert.equal(JSON.parse(JSON.stringify(response)).error.value, value);
  });
}

test('nested metadata is checked before any output is written', () => {
  const response = readJson('json_boundary:write_planning_json(current_output, _{lines:[], provenance:[_{version:9007199254740993}]})');
  assert.deepEqual(Object.keys(response), ['error']);
  assert.equal(response.error.field, '$.provenance[0].version');
  assert.equal(response.error.value, '9007199254740993');
});

test('shared module preserves scenario and execution context without loading the demo', () => {
  const response = readJson(
    'json_boundary:write_planning_json(current_output, _{scenarioId:"scenario-a", executionId:"run-a", lines:[_{requiredUnits:9007199254740993}]})',
    'ai/src/json_boundary.pl',
  );
  assert.deepEqual(Object.keys(response).sort(), ['error', 'executionId', 'scenarioId']);
  assert.equal(response.scenarioId, 'scenario-a');
  assert.equal(response.executionId, 'run-a');
  assert.equal(response.error.scenarioId, 'scenario-a');
  assert.equal(response.error.executionId, 'run-a');
  assert.equal(response.error.value, '9007199254740993');
});

test('invalid numeric context is not copied back into the error response', () => {
  const response = readJson(
    'json_boundary:write_planning_json(current_output, _{scenarioId:"scenario-a", executionId:9007199254740993})',
    'ai/src/json_boundary.pl',
  );
  assert.equal(response.scenarioId, 'scenario-a');
  assert.equal(response.error.scenarioId, 'scenario-a');
  assert.equal(response.executionId, undefined);
  assert.equal(response.error.executionId, undefined);
  assert.equal(response.error.field, '$.executionId');
  assert.equal(response.error.value, '9007199254740993');
});

function calculate(quantity) {
  return readJson([
    'bom_fixtures:bom_fixture(cheese_example, Base)',
    'put_dict(pizza_boms, Base, [bom("medium-cheese", "PROD-90020", "PSIZE-0002", [component("PROD-90003", 1)])], UnitBase)',
    `put_dict(pizza_demand, UnitBase, [pizza_demand(none, "medium-cheese", ${quantity})], Input)`,
    'bom:bom_requirements(Input, ok(Lines))',
    'get_dict(meta, Input, Meta)',
    'put_dict(lines, Meta, Lines, Response)',
    'json_boundary:write_planning_json(current_output, Response)',
  ].join(', '));
}

test('calculated quantities at the safe limit survive the web round trip', () => {
  const response = JSON.parse(JSON.stringify(calculate('9007199254740991')));
  assert.equal(BigInt(response.lines[0].requiredUnits), 9007199254740991n);
  assert.equal(BigInt(response.lines[0].replenishmentUnits), 9007199254740591n);
});

test('exact Prolog calculation above the safe limit is rejected on output', () => {
  const response = calculate('9007199254740993');
  assert.equal(response.error.code, 'JSON_INTEGER_OUT_OF_RANGE');
  assert.equal(response.error.field, '$.lines[0].requiredUnits');
  assert.equal(response.error.value, '9007199254740993');
  assert.equal(response.scenarioId, 'cheese_example');
  assert.equal(response.executionId, '00000000-0000-4000-8000-000000000002');
  assert.equal(response.error.scenarioId, response.scenarioId);
  assert.equal(response.error.executionId, response.executionId);
});

test('all versioned demos round-trip without unsafe numeric fields', () => {
  const names = ['worked', 'sufficient_stock', 'shortage', 'shared_ingredient', 'personalized',
    'ordered_ham_cheese', 'cheese_example', 'briefcase', 'iarti', 'iarti_balanced'];
  for (const name of names) {
    const response = readJson(`demo(${name})`);
    assert.equal(response.error, undefined, name);
    const restored = JSON.parse(JSON.stringify(response));
    assert.equal(restored.scenarioId, name);
    for (const row of restored.lines) {
      for (const [field, value] of Object.entries(row)) {
        if (field !== 'productId') assert(Number.isSafeInteger(value), `${name}: ${field}`);
      }
    }
  }
});
