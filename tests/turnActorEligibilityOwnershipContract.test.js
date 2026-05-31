const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'turnActorEligibilityRules.mjs');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

test('simulation core module exposes a Rust-owned turn actor eligibility marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_TURN_ACTOR_ELIGIBILITY_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreTurnActorEligibilityResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.turnActorEligibilityOwner/);
  assert.match(shadowSrc, /turnActorEligibilityOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowTurnActorEligibilityOwner/);
});

test('turn actor eligibility resolver follows Rust owner when Rust and JS disagree', async () => {
  const {
    TURN_ACTOR_ELIGIBILITY_ACT,
    createTurnActorEligibilitySimulationPacket,
    resolveTurnActorEligibility,
  } = await import(pathToFileURL(rulesPath));
  const calls = [];
  const result = resolveTurnActorEligibility({
    source: 'test.turnActorEligibilityOwner',
    turnType: 0,
    actorExists: 1,
    actorHp: 10,
    partyHp: 0,
    roundActive: 0,
    pendingGroupMatches: 0,
    blueBuffSequenceActive: 0,
    ownerHook: (payload) => {
      calls.push(payload);
      return { owner: 'rust', code: TURN_ACTOR_ELIGIBILITY_ACT };
    },
  });

  assert.equal(result.owner, 'rust');
  assert.equal(result.code, TURN_ACTOR_ELIGIBILITY_ACT);
  assert.equal(calls[0].jsCode, 0);
  assert.equal(calls[0].turnType, 0);
  assert.equal(calls[0].partyHp, 0);

  const requests = [];
  const responses = [];
  const packet = createTurnActorEligibilitySimulationPacket({
    source: 'test.packetizedTurnActorEligibility',
    turnType: 0,
    actorExists: 1,
    actorHp: 10,
    partyHp: 0,
    roundActive: 0,
    pendingGroupMatches: 0,
    blueBuffSequenceActive: 0,
    ownerHook: () => ({
      owner: 'rust',
      code: TURN_ACTOR_ELIGIBILITY_ACT,
    }),
    requestFactory(action, context) {
      requests.push({ action, context });
      return {
        contractVersion: 1,
        baselineId: 'test',
        gameState: {
          turnState: {
            turnType: 0,
            actorEligibilityCode: 0,
          },
        },
        action,
        rngState: { seed: 4, draws: 0, owner: 'rust', reason: 'test', lastValue: 0 },
        context,
      };
    },
    responseApplier(response) {
      responses.push(response);
      return response;
    },
  });

  assert.equal(packet.owner, 'rust');
  assert.equal(packet.code, TURN_ACTOR_ELIGIBILITY_ACT);
  assert.equal(packet.jsCode, 0);
  assert.equal(packet.simulationCoreRequest.action.type, 'turn.actorEligibility');
  assert.equal(packet.simulationCoreRequest.action.turnType, 0);
  assert.equal(packet.simulationCoreRequest.action.actorExists, 1);
  assert.equal(packet.simulationCoreRequest.action.partyHp, 0);
  assert.equal(packet.simulationCoreRequest.context.ruleFamily, 'turnActorEligibility');
  assert.equal(packet.simulationCoreResponse.result, 'act');
  assert.equal(packet.simulationCoreResponse.diagnostics.owner, 'rust');
  assert.equal(packet.simulationCoreResponse.diagnostics.jsCode, 0);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnState.actorEligibilityCode, TURN_ACTOR_ELIGIBILITY_ACT);
  assert.equal(packet.simulationCoreResponse.nextGameState.turnState.actorEligibilityReason, 'act');
  assert.equal(requests.length, 1);
  assert.equal(responses.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreRequest)), packet.simulationCoreRequest);
  assert.deepEqual(JSON.parse(JSON.stringify(packet.simulationCoreResponse)), packet.simulationCoreResponse);
});

test('ProcessTurn routes hero and enemy turn gates through Rust-owned eligibility resolver', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const src = fs.readFileSync(modulePath, 'utf8');

    assert.match(src, /createTurnActorEligibilitySimulationPacket/);
    assert.match(src, /__ORKA_TURN_ACTOR_ELIGIBILITY_OWNER__/);
    assert.match(src, /resolveProcessTurnActorEligibility/);
    assert.match(src, /g\.LastTurnActorEligibilityPacket/);
    assert.match(src, /heroEligibility\.code === TURN_ACTOR_ELIGIBILITY_ACT/);
    assert.match(src, /enemyEligibility\.code === TURN_ACTOR_ELIGIBILITY_HOLD/);
    assert.match(src, /enemyEligibility\.code === TURN_ACTOR_ELIGIBILITY_ACT/);
  }
});
