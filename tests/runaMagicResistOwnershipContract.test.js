const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'runaMagicResistRules.mjs');

test('simulation core module exposes a Rust-owned Runa magic-resist marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreRunaMagicResistResolution/);
  assert.match(shadowSrc, /window\.__ORKA_RUNA_MAGIC_RESIST_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowRunaMagicResistOwner/);
});

test('Runa magic-resist resolver follows Rust owner when Rust and JS disagree', async () => {
  const { RUNA_MAGIC_RESIST_MODE_CODES, resolveRunaMagicResist } = await import(pathToFileURL(rulesPath));
  const decision = resolveRunaMagicResist({
    targetIsRuna: 1,
    incomingDamage: 10,
    rollSource: () => 0.7,
    ownerHook: () => ({
      owner: 'rust',
      finalDamage: 0,
      modeCode: RUNA_MAGIC_RESIST_MODE_CODES.nullify,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.finalDamage, 0);
  assert.equal(decision.mode, 'nullify');
  assert.equal(decision.jsDecision.mode, 'no_proc');
});

test('Runa magic-resist packet follows Rust owner when Rust and JS disagree', async () => {
  const {
    RUNA_MAGIC_RESIST_MODE_CODES,
    createRunaMagicResistSimulationPacket,
  } = await import(pathToFileURL(rulesPath));
  const packet = createRunaMagicResistSimulationPacket({
    source: 'test.packetizedRunaMagicResist',
    enemyUID: 9,
    targetUID: 3,
    skillId: 'Enemy_MAG_Single',
    targetIsRuna: 1,
    incomingDamage: 10,
    triggerRoll: 0.7,
    nullifyRoll: 0,
    ownerHook: () => ({
      owner: 'rust',
      finalDamage: 0,
      modeCode: RUNA_MAGIC_RESIST_MODE_CODES.nullify,
    }),
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.finalDamage, 0);
  assert.equal(packet.mode, 'nullify');
  assert.equal(packet.simulationCoreRequest.action.type, 'combat.runaMagicResist');
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'runaMagicResist');
  assert.equal(packet.simulationCoreResponse.result, 'magic_resist');
  assert.equal(packet.simulationCoreResponse.nextGameState.combat.lastRunaMagicResist.finalDamage, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreRequest)), packet.simulationCoreRequest);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});

test('applyRunaMagicResist routes final mitigation through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveRunaMagicResist/);
    assert.match(src, /createRunaMagicResistSimulationPacket/);
    assert.match(src, /__ORKA_RUNA_MAGIC_RESIST_OWNER__/);
    assert.match(src, /g\.LastRunaMagicResist = trace;/);
    assert.match(src, /g\.LastRunaMagicResistPacket/);
  }
});
