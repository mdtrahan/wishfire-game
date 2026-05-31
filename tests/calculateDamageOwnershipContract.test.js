const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'calculateDamageRules.mjs');

test('simulation core module exposes a Rust-owned CalculateDamage marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreCalculateDamageResolution/);
  assert.match(shadowSrc, /window\.__ORKA_CALCULATE_DAMAGE_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowCalculateDamageOwner/);
});

test('CalculateDamage routes final damage through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /calculateDamageFromJs/);
    assert.match(src, /createCalculateDamageSimulationPacket/);
    assert.match(src, /__ORKA_CALCULATE_DAMAGE_OWNER__/);
    assert.match(src, /maybeResolveCalculateDamageOwner/);
    assert.match(src, /g\.LastCalculateDamagePacket/);
    assert.match(src, /actionType: String\(result\?\.simulationCoreRequest\?\.action\?\.type \|\| ''\)/);
  }
});

test('calculate damage packet follows Rust owner when Rust and JS disagree', async () => {
  const {
    calculateDamageFromJs,
    createCalculateDamageSimulationPacket,
  } = await import(pathToFileURL(rulesPath));
  const jsDecision = calculateDamageFromJs({
    power: 22,
    resist: 8,
    roll01: 0.25,
    critRoll01: 0.9,
    sourceIsHero: 1,
    heroAoe: 0,
    chainActive: 0,
    chainMultiplier: 1,
  });
  const requests = [];
  const responses = [];
  const packet = createCalculateDamageSimulationPacket({
    source: 'test.packetizedCalculateDamage',
    attackerUID: 1,
    targetUID: 101,
    mode: 'physical',
    power: 22,
    resist: 8,
    roll01: 0.25,
    critRoll01: 0.9,
    sourceIsHero: 1,
    heroAoe: 0,
    chainActive: 0,
    chainMultiplier: 1,
    ownerHook: (payload) => ({
      owner: 'rust',
      damage: Number(payload.jsDamage || 0) + 7,
    }),
    requestFactory(action, context) {
      requests.push({ action, context });
      return {
        contractVersion: 1,
        baselineId: 'test',
        gameState: {
          combat: {
            lastDamage: {
              damage: 0,
            },
          },
        },
        action,
        rngState: { seed: 7, draws: 2, owner: 'rust', reason: 'test', lastValue: 0.9 },
        context,
      };
    },
    responseApplier(response) {
      responses.push(response);
      return response;
    },
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.damage, jsDecision.damage + 7);
  assert.equal(packet.jsDecision.damage, jsDecision.damage);
  assert.equal(packet.simulationCoreRequest.action.type, 'combat.calculateDamage');
  assert.equal(packet.simulationCoreRequest.action.power, 22);
  assert.equal(packet.simulationCoreRequest.action.resist, 8);
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'calculateDamage');
  assert.equal(packet.simulationCoreResponse.result, 'damage');
  assert.equal(packet.simulationCoreResponse.diagnostics.owner, 'rust');
  assert.equal(packet.simulationCoreResponse.diagnostics.jsDamage, jsDecision.damage);
  assert.equal(packet.simulationCoreResponse.nextGameState.combat.lastDamage.damage, jsDecision.damage + 7);
  assert.equal(requests.length, 1);
  assert.equal(responses.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreRequest)), packet.simulationCoreRequest);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});
