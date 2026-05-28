const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const entitiesPath = path.join(__dirname, '..', 'Scripts', 'entities.js');

function loadEntitiesModule(testState) {
  const src = fs.readFileSync(entitiesPath, 'utf8')
    .replace("import { state } from './state.js';", 'const state = globalThis.__TEST_STATE;')
    .replace(/export default\s+\{[\s\S]*?\};?/g, '')
    .replace(/export /g, '');
  const warnings = [];
  const context = {
    globalThis: { __TEST_STATE: testState },
    console: {
      warn: (...args) => warnings.push(args),
    },
    Date: { now: () => 12345 },
  };
  const wrapped = `(function(){${src}; return { updateAllEntities, registerEntity, createActor, ENTITY_UPDATE_MAX_FAILURES }; })()`;
  const mod = vm.runInNewContext(wrapped, context, { filename: 'Scripts/entities.js' });
  return { ...mod, warnings };
}

test('repeated entity update failures are quarantined and attributed to a stable entity key', () => {
  const testState = { entities: [], globals: {} };
  const { updateAllEntities, ENTITY_UPDATE_MAX_FAILURES, warnings } = loadEntitiesModule(testState);
  let attempts = 0;
  testState.entities.push({
    uid: 42,
    kind: 'hero',
    name: 'Huun',
    update() {
      attempts += 1;
      throw new Error('boom');
    },
  });

  for (let i = 0; i < ENTITY_UPDATE_MAX_FAILURES + 2; i += 1) updateAllEntities();

  assert.equal(attempts, ENTITY_UPDATE_MAX_FAILURES);
  assert.equal(testState.globals.EntityUpdateTrace.length, ENTITY_UPDATE_MAX_FAILURES);
  const last = testState.globals.EntityUpdateTrace.at(-1);
  assert.equal(last.key, 'uid:42');
  assert.equal(last.consecutiveFailures, ENTITY_UPDATE_MAX_FAILURES);
  assert.equal(last.quarantined, 1);
  assert.equal(testState.globals.EntityQuarantineByKey['uid:42'].message, 'boom');
  assert.equal(warnings.length, ENTITY_UPDATE_MAX_FAILURES);
});

test('successful entity update clears consecutive failure count before the next fault', () => {
  const testState = { entities: [], globals: {} };
  const { updateAllEntities } = loadEntitiesModule(testState);
  let shouldThrow = true;
  testState.entities.push({
    kind: 'enemy',
    name: 'Gobloc',
    update() {
      if (shouldThrow) throw new Error('first');
    },
  });

  updateAllEntities();
  shouldThrow = false;
  updateAllEntities();
  shouldThrow = true;
  updateAllEntities();

  assert.equal(testState.globals.EntityUpdateTrace.length, 2);
  assert.equal(testState.globals.EntityUpdateTrace[0].consecutiveFailures, 1);
  assert.equal(testState.globals.EntityUpdateTrace[1].consecutiveFailures, 1);
  assert.equal(
    testState.globals.EntityUpdateTrace[1].key,
    'enemy:gobloc:0',
  );
});
