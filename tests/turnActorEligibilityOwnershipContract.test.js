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
});

test('ProcessTurn routes hero and enemy turn gates through Rust-owned eligibility resolver', () => {
  for (const modulePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const src = fs.readFileSync(modulePath, 'utf8');

    assert.match(src, /resolveTurnActorEligibility/);
    assert.match(src, /__ORKA_TURN_ACTOR_ELIGIBILITY_OWNER__/);
    assert.match(src, /resolveProcessTurnActorEligibility/);
    assert.match(src, /heroEligibility\.code === TURN_ACTOR_ELIGIBILITY_ACT/);
    assert.match(src, /enemyEligibility\.code === TURN_ACTOR_ELIGIBILITY_HOLD/);
    assert.match(src, /enemyEligibility\.code === TURN_ACTOR_ELIGIBILITY_ACT/);
  }
});
