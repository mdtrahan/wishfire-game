const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const fixturePath = path.join(__dirname, 'fixtures', 'combat_snapshot_gate_cases.csv');

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function readFixtures() {
  const [headerLine, ...lines] = fs.readFileSync(fixturePath, 'utf8').trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
  });
}

function toNumber(row, key) {
  return Number(row[key] || 0);
}

test('combat snapshot gate fixtures encode current JS gateway snapshot semantics', () => {
  const rows = readFixtures();
  assert.ok(rows.length >= 8);
  assert.equal(rows.find((row) => row.name === 'pre-valid-queue').expectedIndexFailureCode, '0');
  assert.equal(rows.find((row) => row.name === 'pre-non-array').expectedIndexFailureCode, '1');
  assert.equal(rows.find((row) => row.name === 'pre-out-of-range').expectedIndexFailureCode, '2');
  assert.equal(rows.find((row) => row.name === 'pre-empty-bad-index').expectedIndexFailureCode, '3');
  assert.equal(rows.find((row) => row.name === 'snapshot-valid').expectedSchemaValid, '1');
  assert.equal(rows.find((row) => row.name === 'snapshot-non-integer-index').expectedSchemaValid, '0');
  assert.equal(rows.find((row) => row.name === 'snapshot-missing-token').expectedSchemaValid, '0');
  assert.equal(rows.find((row) => row.name === 'post-token-mismatch').expectedResumeTokenValid, '0');
});

test('Rust simulation core declares combat snapshot gate shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  assert.match(rustSrc, /pub fn combat_snapshot_index_failure_code/);
  assert.match(rustSrc, /pub fn combat_snapshot_schema_valid/);
  assert.match(rustSrc, /pub fn combat_snapshot_resume_token_valid/);
  assert.match(rustSrc, /extern "C" fn combat_snapshot_index_failure_code_shadow/);
  assert.match(rustSrc, /extern "C" fn combat_snapshot_schema_valid_shadow/);
  assert.match(rustSrc, /extern "C" fn combat_snapshot_resume_token_valid_shadow/);
});

test('static simulation core wasm matches combat snapshot gate fixtures', async () => {
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const { exports } = result.instance;
  assert.equal(typeof exports.combat_snapshot_index_failure_code_shadow, 'function');
  assert.equal(typeof exports.combat_snapshot_schema_valid_shadow, 'function');
  assert.equal(typeof exports.combat_snapshot_resume_token_valid_shadow, 'function');

  for (const row of readFixtures()) {
    const indexFailureCode = Number(exports.combat_snapshot_index_failure_code_shadow(
      toNumber(row, 'turnQueueIsArray'),
      toNumber(row, 'turnQueueLength'),
      toNumber(row, 'currentActorIndex'),
    ));
    const schemaValid = Number(exports.combat_snapshot_schema_valid_shadow(
      toNumber(row, 'snapshotVersion'),
      toNumber(row, 'hasTurnState'),
      toNumber(row, 'turnQueueIsArray'),
      toNumber(row, 'turnQueueLength'),
      toNumber(row, 'currentActorIndex'),
      toNumber(row, 'hasResumeToken'),
    ));
    const resumeTokenValid = Number(exports.combat_snapshot_resume_token_valid_shadow(
      toNumber(row, 'hasExpectedToken'),
      toNumber(row, 'capturedAtTick'),
      toNumber(row, 'turnQueueLength'),
      toNumber(row, 'currentActorIndex'),
      toNumber(row, 'expectedCapturedAtTick'),
      toNumber(row, 'expectedTurnQueueLength'),
      toNumber(row, 'expectedCurrentActorIndex'),
    ));

    assert.equal(indexFailureCode, toNumber(row, 'expectedIndexFailureCode'), `${row.name} wasm index failure`);
    assert.equal(schemaValid, toNumber(row, 'expectedSchemaValid'), `${row.name} wasm schema valid`);
    assert.equal(resumeTokenValid, toNumber(row, 'expectedResumeTokenValid'), `${row.name} wasm resume token valid`);
  }
});
