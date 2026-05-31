const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const runtimeRulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'seededRngRules.mjs');
const sourceRulesPath = path.join(__dirname, '..', 'src', 'core', 'seededRngRules.mjs');

function assertJsonSafe(value, label) {
  assert.deepEqual(JSON.parse(JSON.stringify(value)), value, label);
}

test('seeded RNG rule module mirrors runtime and source copies exactly', () => {
  assert.equal(
    fs.readFileSync(runtimeRulesPath, 'utf8'),
    fs.readFileSync(sourceRulesPath, 'utf8'),
  );
});

test('seeded RNG packet function exposes JSON-safe SimulationCore request and response', async () => {
  const rules = await import(pathToFileURL(runtimeRulesPath));
  const packet = rules.createSeededRngSimulationPacket({
    source: 'test.seededRng',
    seed: 123,
    draws: 4,
    size: 7,
    jsState: 111,
    jsValue: 0.25,
    jsIndex: 1,
    rngState: { owner: 'rust', reason: 'fixture' },
    ownerHook: () => ({
      owner: 'rust',
      state: 987654321,
      value: 0.75,
      index: 5,
    }),
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.state, 987654321);
  assert.equal(packet.value, 0.75);
  assert.equal(packet.index, 5);
  assert.equal(packet.simulationCoreRequest.action.type, 'rng.seededNext');
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'seededRng');
  assert.equal(packet.simulationCoreResponse.result, 'seeded_rng');
  assert.equal(packet.simulationCoreResponse.diagnostics.ruleFamily, 'seededRng');
  assertJsonSafe(packet.simulationCoreRequest, 'seeded RNG request JSON-safe');
  assertJsonSafe(packet.simulationCoreResponse, 'seeded RNG response JSON-safe');
});
