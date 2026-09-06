const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'combatOutcomeRules.mjs');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

test('simulation core module exposes a Rust-owned combat outcome marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_COMBAT_OUTCOME_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreCombatOutcomeResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.combatOutcomeOwner/);
  assert.match(shadowSrc, /combatOutcomeOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowCombatOutcomeOwner/);
});

test('combat outcome resolver follows Rust owner when Rust and JS disagree', async () => {
  const {
    combatOutcomeReasonFromCode,
    createCombatOutcomeSimulationPacket,
    resolveCombatOutcome,
  } = await import(pathToFileURL(rulesPath));
  const calls = [];
  const result = resolveCombatOutcome({
    source: 'test.combatOutcomeOwner',
    energy: 10,
    partyHp: 40,
    livingHeroes: 4,
    ownerHook: (payload) => {
      calls.push(payload);
      return { owner: 'rust', code: 2 };
    },
  });

  assert.equal(result.owner, 'rust');
  assert.equal(result.code, 2);
  assert.equal(result.reason, 'party_defeated');
  assert.equal(combatOutcomeReasonFromCode(0), '');
  assert.equal(calls[0].jsCode, 0);
  assert.equal(calls[0].energy, 10);
  assert.equal(calls[0].partyHp, 40);
  assert.equal(calls[0].livingHeroes, 4);

  const requests = [];
  const responses = [];
  const packet = createCombatOutcomeSimulationPacket({
    source: 'test.packetizedCombatOutcome',
    energy: 10,
    partyHp: 40,
    livingHeroes: 4,
    ownerHook: () => ({ owner: 'rust', code: 2 }),
    requestFactory(action, context) {
      requests.push({ action, context });
      return {
        contractVersion: 1,
        baselineId: 'test',
        gameState: { turnState: { turnQueue: [], currentActorIndex: 0, capturedAtTick: 0 } },
        action,
        rngState: { seed: 1, draws: 0, owner: 'rust', reason: 'test', lastValue: 0 },
        context,
      };
    },
    responseApplier(response) {
      responses.push(response);
      return response;
    },
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.code, 2);
  assert.equal(packet.reason, 'party_defeated');
  assert.equal(packet.simulationCoreRequest.action.type, 'combat.outcome');
  assert.equal(packet.simulationCoreRequest.action.energy, 10);
  assert.equal(packet.simulationCoreRequest.action.partyHp, 40);
  assert.equal(packet.simulationCoreRequest.action.livingHeroes, 4);
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'combatOutcome');
  assert.equal(packet.simulationCoreResponse.result, 'party_defeated');
  assert.equal(packet.simulationCoreResponse.diagnostics.owner, 'rust');
  assert.equal(packet.simulationCoreResponse.diagnostics.jsCode, 0);
  assert.equal(requests.length, 1);
  assert.equal(responses.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});

test('dev autoplay and main runtime stop checks route through Rust-owned combat outcome resolver', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');

  assert.match(appSrc, /createCombatOutcomeSimulationPacket/);
  assert.match(appSrc, /__ORKA_COMBAT_OUTCOME_OWNER__/);
  assert.match(appSrc, /function resolveCombatOutcomeWithOwner/);
  assert.match(appSrc, /combatRuntimeGateway\.createSimulationCoreRequest\(action, context\)/);
  assert.match(appSrc, /combatRuntimeGateway\.applySimulationCoreResponse\(response\)/);
  assert.match(appSrc, /LastCombatOutcomePacket/);
  assert.match(appSrc, /function resolveMainRuntimeCombatOutcome/);
  assert.match(appSrc, /app\.runDevAutoplayUntilDepleted/);
  assert.match(appSrc, /app\.mainRuntimeCombatOutcome/);
  assert.doesNotMatch(appSrc, /energy: Number\(energy/);
  assert.match(appSrc, /const outcome = resolveMainRuntimeCombatOutcome\(\{ energy, partyHp, livingHeroes \}\);/);
  assert.match(appSrc, /lastReason: outcome\.reason/);
  assert.match(appSrc, /requestCombatFailureExit\(outcome\.reason\)/);
});
